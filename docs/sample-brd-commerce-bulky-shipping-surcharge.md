# Bulky-Item Shipping Surcharge

**Business Requirements Document**

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Draft |
| Author | Fulfillment Ops (via Product) |
| Last updated | 2026-08-09 |
| Product owner | VP Fulfillment |
| Tech lead | TBD |
| Target release | Next sprint |
| Stack | commerce-paas |
| Role driving | tl |

---

## 1. Executive summary

### 1.1 Business context

Fulfillment flagged that large/bulky SKUs (furniture, large appliances, oversized outdoor items) cost significantly more to ship than standard parcels, but our current shipping rates don't reflect that — every order ships at the same carrier-calculated rate regardless of item size class. On bulky-SKU orders this is quietly eating margin: freight cost exceeds what the order recovers.

### 1.2 Opportunity

Recover the under-recovered freight cost on bulky-item orders by applying a flat, transparent handling surcharge whenever a bulky item is in the cart — without discouraging the purchase or making pricing feel punitive.

### 1.3 Expected value

Bulky-order gross margin returns to target on freight-heavy SKUs. Because the surcharge is flat (not per-item, not carrier-passthrough), pricing stays predictable for the customer and easy to explain at checkout.

### 1.4 Success metrics

- Bulky-order freight margin recovers to the same target margin as standard orders within one release cycle.
- No measurable increase in cart-abandonment rate on carts containing a bulky item, pre- vs. post-launch.
- Surcharge is visible to the customer before payment is entered on 100% of qualifying orders (no silent charges).

---

## 2. Scope

### 2.1 In-scope

- A single flat surcharge applied once per order when the cart contains **at least one** bulky item — not stacked per bulky item.
- Surcharge shown as its own labeled line item in cart and order summary.
- Surcharge amount configurable by store admins without a code deploy.
- A new product-level flag identifying which SKUs are "bulky."

### 2.2 Out-of-scope

- Per-item surcharge stacking (multiple bulky items in one cart still incur the surcharge exactly once).
- Carrier-specific bulky/oversize rate integration (e.g. dimensional-weight pricing from the carrier API) — this is a flat business rule, not a rate-shopping change.
- Changes to existing shipping methods or carriers themselves.

### 2.3 Assumptions

- Bulky SKUs are not yet tagged in the catalog today — this needs a new attribute, not a lookup against existing data.
- Catalog/merchandising will backfill the attribute on existing bulky SKUs post-release; new SKUs are tagged at creation going forward.

### 2.4 Dependencies

- None blocking for this release. Catalog backfill is a parallel, non-blocking workstream.

---

## 5. Business requirements

**BR-1** — Recover under-recovered freight cost on bulky-item orders
> The business needs a way to apply an additional shipping charge specifically to orders containing large/bulky items, since standard carrier-calculated shipping rates undercharge for these.
- **Source**: Fulfillment ops margin review, Q3
- **MoSCoW**: MUST
- **Rationale**: bulky-item orders currently ship at a loss on freight; recovering this margin is the primary driver for this request.

---

## 6. Functional requirements

**FR-1** — Flag bulky products
> The system must support a boolean product attribute (`is_bulky_item`) settable per SKU from the admin catalog grid/edit page.
- **Parent BR**: BR-1
- **MoSCoW**: MUST
- **Effort**: S

**FR-2** — Apply flat surcharge at cart/checkout
> When the cart contains at least one bulky item, the system must add a single flat surcharge (admin-configurable amount, default **$25.00**) to the order total. The surcharge applies exactly once per order regardless of how many bulky items — or what quantity of a bulky item — are in the cart.
- **Parent BR**: BR-1
- **MoSCoW**: MUST
- **Effort**: M

**FR-3** — Surcharge visibility
> The surcharge must appear as its own line item in the cart summary, mini-cart, and order summary, labeled **"Bulky Item Handling Fee,"** visible before the customer enters payment details.
- **Parent BR**: BR-1
- **MoSCoW**: MUST
- **Effort**: S

**FR-4** — Admin configuration
> Store admins must be able to change the surcharge amount and enable/disable the feature entirely from **Stores → Configuration**, without a code deploy or catalog re-index.
- **Parent BR**: BR-1
- **MoSCoW**: SHOULD
- **Effort**: S

---

## 7. Non-functional requirements

### 7.2 Security / integrity

The surcharge calculation must be enforced **server-side** during quote-totals collection — not computed or trusted from client-submitted cart data — so a tampered checkout request cannot strip the surcharge before payment capture.

### 7.6 Compliance

No PII or payment-data handling introduced by this feature. Surcharge amount and label must be included in any tax-calculation base per existing store tax configuration (no special-case tax treatment requested).

---

## 12. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Product owner | | | |
| Tech lead | | | |
| Enterprise architect | | | |

---

_Sample input for the BMAD DCA Generation agent demo — not a real production BRD._
