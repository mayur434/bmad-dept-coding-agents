# Adobe Commerce PaaS (Magento 2) — Test Generation (LLM, target 100% coverage)

Generate PHPUnit unit tests (plus integration/MFTF where noted) directly from Magento 2 source so every public method, branch, exception path, and security guard is exercised.

## Framework & dependencies

PHP stack — build wiring is **Composer**, never Maven/Gradle/npm. Magento's own package `magento/framework` (already in `require`) supplies the unit test helper `Magento\Framework\TestFramework\Unit\Helper\ObjectManager`; the integration framework lives under `dev/tests/integration/framework`.

`composer.json` (`require-dev`), pinned to the platform's Magento line:

```json
"require-dev": {
    "phpunit/phpunit": "~9.6.0",                                  // Magento 2.4.4–2.4.6; use ~10.5 on 2.4.7+
    "magento/magento2-functional-testing-framework": "^4.7",      // MFTF (functional)
    "phpstan/phpstan": "^1.10",
    "phpcompatibility/php-compatibility": "^9.3",
    "allure-framework/allure-phpunit": "^2"                        // 2.4.7+
}
```

Run wiring:

```bash
# Unit — MUST use Magento's bootstrap (defines __(), autoloaders, Phrase)
vendor/bin/phpunit -c dev/tests/unit/phpunit.xml.dist app/code/Vendor/Module/Test/Unit
# Coverage (needs pcov or xdebug driver)
vendor/bin/phpunit -c dev/tests/unit/phpunit.xml.dist --coverage-html var/coverage app/code/Vendor/Module
# Integration
vendor/bin/phpunit -c dev/tests/integration/phpunit.xml.dist app/code/Vendor/Module/Test/Integration
# Functional (MFTF)
vendor/bin/mftf run:test Vendor_Module_SomeCest
```

A module may also ship its own `Test/Unit/phpunit.xml` whose `bootstrap` points at `dev/tests/unit/framework/bootstrap.php`. Coverage driver is configured via the `<coverage>`/`<source>` block in `phpunit.xml.dist`.

## Where tests go & naming

Unit tests live at `app/code/Vendor/Module/Test/Unit/` and **mirror the source namespace and directory** under `Test\Unit`:

| Source | Test |
|---|---|
| `Vendor/Module/Model/OrderProcessor.php`<br>`Vendor\Module\Model\OrderProcessor` | `Vendor/Module/Test/Unit/Model/OrderProcessorTest.php`<br>`Vendor\Module\Test\Unit\Model\OrderProcessorTest` |
| `Vendor/Module/Model/Resolver/CustomerReward.php` | `Vendor/Module/Test/Unit/Model/Resolver/CustomerRewardTest.php` |
| `Vendor/Module/Plugin/ProductPricePlugin.php` | `Vendor/Module/Test/Unit/Plugin/ProductPricePluginTest.php` |

Rules: test class = `{SourceClass}Test`, `extends PHPUnit\Framework\TestCase`, one test file per source class. Test methods are `test`-prefixed and behavior-named (`testResolveThrowsAuthorizationExceptionForGuest`). Integration tests go to `Test/Integration/`, MFTF to `Test/Mftf/`.

## Test anatomy

Required imports + the `setUp()` boilerplate every generated unit test uses. The SUT is built with `ObjectManagerHelper->getObject(Class, ['ctorParamName' => $mock])` — it auto-fills any constructor arg you omit with a generated dummy, so you only pass the deps you assert on.

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Test\Unit\Model;

use Magento\Framework\TestFramework\Unit\Helper\ObjectManager;
use Magento\Framework\Event\ObserverInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Vendor\Module\Api\OrderRepositoryInterface;
use Vendor\Module\Model\OrderProcessor;

class OrderProcessorTest extends TestCase
{
    private ObjectManager $objectManager;
    private OrderProcessor $sut;

    /** @var OrderRepositoryInterface&MockObject */
    private $repository;         // keep untyped: the declared type is the interface, the value is a MockObject
    /** @var LoggerInterface&MockObject */
    private $logger;

    protected function setUp(): void
    {
        $this->objectManager = new ObjectManager($this);
        $this->repository = $this->createMock(OrderRepositoryInterface::class);
        $this->logger     = $this->createMock(LoggerInterface::class);

        $this->sut = $this->objectManager->getObject(
            OrderProcessor::class,
            ['repository' => $this->repository, 'logger' => $this->logger] // keys = ctor param names
        );
    }
}
```

For concrete/heavy classes use `getMockBuilder`:

```php
$product = $this->getMockBuilder(\Magento\Catalog\Model\Product::class)
    ->disableOriginalConstructor()
    ->onlyMethods(['getPrice', 'getSku'])   // real methods; unlisted methods keep real behavior
    ->getMock();
```

## Reaching 100%

Apply this checklist to **each source class**:

- **One test method per public method.** Private/protected methods are never tested directly — cover them by driving the public method that calls them, choosing inputs that reach each private branch.
- **A case per branch/condition.** Every `if/else`, ternary, `switch` arm, `??`, and early return needs an input that takes it. Use `@dataProvider` to enumerate a branch matrix compactly.
- **Every thrown-exception / error path.** Assert with `expectException(...)` + `expectExceptionMessage(...)` (substring match). Cover both the SUT's own `throw` and dependencies that throw (stub `willThrowException(new NoSuchEntityException(__('...')))`) — assert the SUT re-wraps them (e.g. `NoSuchEntityException` → `GraphQlNoSuchEntityException`).
- **Boundary + null/empty inputs.** `0`, `-1`, `''`, `[]`, `null` args, missing array keys (`$args['id'] ?? 0`), empty collections. For `(int)` casts, feed non-numeric to prove the `<= 0` guard fires.
- **Security-negative cases.** GraphQL resolvers: guest/unauthenticated + **cross-customer (IDOR)** access. Controllers/ACL: unauthorized user. Always add the failing-authorization branch — it is the most-missed uncovered line.
- **Assert result AND side effect.** Assert the return value, and set `expects($this->once())` / `$this->never())` on collaborators to lock in whether they were called on that branch.

Per unit type:

- **Plugins** — test the interceptor method directly, **asserting the wrapped result**. `after{X}($subject, $result, ...$args)` → assert the transformed `$result`. `before{X}($subject, $arg)` → assert the returned modified-args array (or `null`). `around{X}($subject, callable $proceed, ...)` → assert the value after `$proceed` runs, and add a branch where the plugin short-circuits and `$proceed` is **not** invoked.
- **Observers** — call `execute()` with a mocked `Observer`; stub `$observer->getEvent()->getData(...)` / `->getOrder()`; assert the delegated service call and that `execute` returns `void`.
- **Models/Repositories** — CRUD + `SearchCriteria` paths; `save`/`getById`/`delete`; not-found → `NoSuchEntityException`; validation failure → `CouldNotSaveException`/`InputException`.
- **Resolvers** — call `resolve()` with mocked `Field`/`$context`/`ResolveInfo` and stubbed `$value`/`$args`; cover auth-negative, input-missing, entity-not-found, and happy array shape.
- **Blocks/ViewModels** — construct via `getObject`, stub injected data sources, assert the getter/prepared-data transformation (including empty-data fallbacks).

## Mocking strategy

**Mock (via `createMock` / `getMockBuilder`):** every injected dependency — repositories, service contracts (`*Interface`), `LoggerInterface`, `EventManager`, resource models, `StoreManagerInterface`, HTTP request/response. GraphQL plumbing: `Field`, `ResolveInfo`, and `$context` (`Magento\GraphQl\Model\Query\ContextInterface`, stub `getUserId()`/`getUserType()`). For observers, mock `Observer` and its `Event`.

**Use real (never mock):** DTOs / value objects, `Magento\Framework\DataObject`, phrases from `__()`, enums/constants, and the SUT itself. Mocking a concrete model with `createMock` nulls out its real getters and hides the logic you meant to test — build value objects with `$this->objectManager->getObject(SomeData::class, [...])` or `new` instead.

- Fluent APIs (collections, setters returning `$this`) → `->willReturnSelf()`, else the chained call returns `null`.
- Around-plugin `$proceed` is a **plain callable**, not the subject method. Stub it and assert invocation:

```php
$subject = $this->createMock(TargetService::class);
$proceed = fn (): string => 'ORIGINAL';                 // happy path
$this->assertSame('ORIGINAL::decorated', $this->sut->aroundGetName($subject, $proceed));

$proceed = function (): string { $this->fail('proceed must not run'); }; // short-circuit branch
$this->assertSame('CACHED', $this->sut->aroundGetName($subject, $proceed));
```

## Worked example

Source — a GraphQL resolver with an auth guard, input guard, not-found wrap, IDOR guard, and a happy path:

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Model\Resolver;

use Magento\Authorization\Model\UserContextInterface;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\GraphQl\Config\Element\Field;
use Magento\Framework\GraphQl\Exception\GraphQlAuthorizationException;
use Magento\Framework\GraphQl\Exception\GraphQlInputException;
use Magento\Framework\GraphQl\Exception\GraphQlNoSuchEntityException;
use Magento\Framework\GraphQl\Query\ResolverInterface;
use Magento\Framework\GraphQl\Schema\Type\ResolveInfo;
use Vendor\Module\Api\RewardRepositoryInterface;

class CustomerReward implements ResolverInterface
{
    public function __construct(
        private readonly RewardRepositoryInterface $rewardRepository
    ) {
    }

    public function resolve(Field $field, $context, ResolveInfo $info, ?array $value = null, ?array $args = null)
    {
        if ((int) $context->getUserType() === UserContextInterface::USER_TYPE_GUEST) {
            throw new GraphQlAuthorizationException(__('The current customer is not authorized.'));
        }
        $customerId = (int) $context->getUserId();

        $rewardId = (int) ($args['reward_id'] ?? 0);
        if ($rewardId <= 0) {
            throw new GraphQlInputException(__('A "reward_id" value is required.'));
        }

        try {
            $reward = $this->rewardRepository->getById($rewardId);
        } catch (NoSuchEntityException $e) {
            throw new GraphQlNoSuchEntityException(__('Reward with id "%1" does not exist.', $rewardId), $e);
        }

        if ((int) $reward->getCustomerId() !== $customerId) {
            throw new GraphQlAuthorizationException(__('This reward does not belong to the current customer.'));
        }

        return [
            'reward_id' => (int) $reward->getId(),
            'points'    => (int) $reward->getPoints(),
            'balance'   => $reward->getBalance(),
        ];
    }
}
```

Complete generated test — every branch, exception, boundary, and both security-negative paths:

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Test\Unit\Model\Resolver;

use Magento\Authorization\Model\UserContextInterface;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\GraphQl\Config\Element\Field;
use Magento\Framework\GraphQl\Exception\GraphQlAuthorizationException;
use Magento\Framework\GraphQl\Exception\GraphQlInputException;
use Magento\Framework\GraphQl\Exception\GraphQlNoSuchEntityException;
use Magento\Framework\GraphQl\Schema\Type\ResolveInfo;
use Magento\Framework\TestFramework\Unit\Helper\ObjectManager;
use Magento\GraphQl\Model\Query\ContextInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Vendor\Module\Api\Data\RewardInterface;
use Vendor\Module\Api\RewardRepositoryInterface;
use Vendor\Module\Model\Resolver\CustomerReward;

class CustomerRewardTest extends TestCase
{
    private CustomerReward $sut;

    /** @var RewardRepositoryInterface&MockObject */
    private $rewardRepository;
    /** @var ContextInterface&MockObject */
    private $context;
    /** @var Field&MockObject */
    private $field;
    /** @var ResolveInfo&MockObject */
    private $info;

    protected function setUp(): void
    {
        $objectManager = new ObjectManager($this);
        $this->rewardRepository = $this->createMock(RewardRepositoryInterface::class);
        $this->context = $this->createMock(ContextInterface::class);
        $this->field   = $this->createMock(Field::class);
        $this->info    = $this->createMock(ResolveInfo::class);

        $this->sut = $objectManager->getObject(
            CustomerReward::class,
            ['rewardRepository' => $this->rewardRepository]
        );
    }

    private function invoke(?array $args): array
    {
        return $this->sut->resolve($this->field, $this->context, $this->info, null, $args);
    }

    private function asCustomer(int $id = 42): void
    {
        $this->context->method('getUserType')->willReturn(UserContextInterface::USER_TYPE_CUSTOMER);
        $this->context->method('getUserId')->willReturn($id);
    }

    public function testResolveThrowsAuthorizationExceptionForGuest(): void
    {
        $this->context->method('getUserType')->willReturn(UserContextInterface::USER_TYPE_GUEST);
        $this->rewardRepository->expects($this->never())->method('getById');

        $this->expectException(GraphQlAuthorizationException::class);
        $this->expectExceptionMessage('The current customer is not authorized.');

        $this->invoke(['reward_id' => 5]);
    }

    /** @dataProvider missingRewardIdProvider */
    public function testResolveThrowsInputExceptionWhenRewardIdInvalid(?array $args): void
    {
        $this->asCustomer();
        $this->rewardRepository->expects($this->never())->method('getById');

        $this->expectException(GraphQlInputException::class);
        $this->expectExceptionMessage('A "reward_id" value is required.');

        $this->invoke($args);
    }

    public function missingRewardIdProvider(): array
    {
        return [
            'null args'      => [null],
            'empty args'     => [[]],
            'zero id'        => [['reward_id' => 0]],
            'negative id'    => [['reward_id' => -3]],
            'non-numeric id' => [['reward_id' => 'abc']],
        ];
    }

    public function testResolveWrapsNoSuchEntityException(): void
    {
        $this->asCustomer();
        $this->rewardRepository->method('getById')->with(5)
            ->willThrowException(new NoSuchEntityException(__('No such entity.')));

        $this->expectException(GraphQlNoSuchEntityException::class);
        $this->expectExceptionMessage('Reward with id "5" does not exist.');

        $this->invoke(['reward_id' => 5]);
    }

    public function testResolveThrowsAuthorizationExceptionForForeignReward(): void
    {
        $this->asCustomer(42);
        $reward = $this->createMock(RewardInterface::class);
        $reward->method('getCustomerId')->willReturn(99);            // owned by someone else (IDOR)
        $this->rewardRepository->method('getById')->with(5)->willReturn($reward);

        $this->expectException(GraphQlAuthorizationException::class);
        $this->expectExceptionMessage('This reward does not belong to the current customer.');

        $this->invoke(['reward_id' => 5]);
    }

    public function testResolveReturnsRewardDataForOwner(): void
    {
        $this->asCustomer(42);
        $reward = $this->createMock(RewardInterface::class);
        $reward->method('getCustomerId')->willReturn(42);
        $reward->method('getId')->willReturn(5);
        $reward->method('getPoints')->willReturn(150);
        $reward->method('getBalance')->willReturn('15.00');
        $this->rewardRepository->expects($this->once())->method('getById')->with(5)->willReturn($reward);

        $result = $this->invoke(['reward_id' => 5]);

        $this->assertSame(
            ['reward_id' => 5, 'points' => 150, 'balance' => '15.00'],
            $result
        );
    }
}
```

## Pitfalls

- **`__()` is not defined under bare PHPUnit.** Running `phpunit` without `-c dev/tests/unit/phpunit.xml.dist` (or a `phpunit.xml` whose bootstrap is `dev/tests/unit/framework/bootstrap.php`) yields `Call to undefined function __()`. Always drive tests through Magento's unit bootstrap.
- **`getObject(['name' => ...])` keys are constructor *parameter names*, not types or property names.** A misspelled key is silently ignored — `getObject` injects an auto-generated dummy instead, your stub never lands, and you get baffling nulls. Match the promoted-property/param name exactly.
- **`ObjectManagerHelper` can't build every class.** Classes that read the `$data` array constructor pattern, pull from `ObjectManagerInterface`/`SessionManager` at construct time, or are `final`/`readonly` need explicit mocks or `getMockBuilder(...)->disableOriginalConstructor()`. `getObject` only maps object type-hints; scalar/array params get defaults or `null`.
- **Don't `createMock` value objects and models.** Mocking a concrete `DataObject`/model replaces its real getters with `null`-returning stubs, masking the logic under test. Build them with `getObject()` or `new`; reserve mocks for injected service dependencies.
- **`around` plugins: `$proceed` is a closure, not the subject.** Stub it as a `callable`; to cover the short-circuit branch assert it is *not* invoked (a closure that calls `$this->fail(...)`), and to cover the pass-through branch assert the value returned after it runs.
- **Expectation/branch mismatch.** `expects($this->once())` on a collaborator the branch under test skips fails the test; use `$this->never())` on skipped paths and `willReturnSelf()` for fluent setters so chained calls don't return `null`.
