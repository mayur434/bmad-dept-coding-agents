# Adobe App Builder — MCP Strategy

## Overview

The Adobe Commerce App Builder MCP server provides AI-powered development tools for generating, deploying, and managing App Builder applications through natural-language prompts. This strategy defines how the BMAD Code Generation Agent integrates with the MCP server.

## MCP Server Details

| Field | Value |
|-------|-------|
| Name | Adobe Commerce App Builder MCP |
| Type | Local MCP server |
| Version | 1.0.0 |
| Auth | IMS auth via `aio auth login` |
| Products | Adobe Commerce, Adobe Developer Console, App Builder |
| Setup Command | `aio commerce extensibility tools-setup` |

## Available MCP Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `aio-app-deploy` | Deploy an App Builder app to Runtime | Deploy specific actions or entire app |
| `aio-app-dev` | Start local development server | Local development and testing |
| `aio-app-use` | Configure runtime namespace | Switch workspace/namespace |
| `aio-configure-global` | Change global Adobe I/O config (org, project, workspace) | Set up or switch context |
| `aio-dev-invoke` | Invoke a locally running action | Test actions during development |
| `aio-login` | Log in to Adobe I/O (OAuth2) | Authenticate before operations |

## Integration Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  Developer Prompt                                           │
│  "Create a Commerce App Builder extension for order export" │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  BMAD Code Generation Agent                                 │
│                                                             │
│  1. Detect platform (App Builder signals in project)        │
│  2. Check MCP server availability                           │
│  3. Use LLM skills for code generation patterns             │
│  4. Invoke MCP tools for deployment/testing                 │
│                                                             │
│  ┌─────────────┐     ┌──────────────────────────────────┐  │
│  │ MCP Server  │────▶│  aio-app-dev (local test)        │  │
│  │             │────▶│  aio-dev-invoke (test action)    │  │
│  │             │────▶│  aio-app-deploy (ship to cloud)  │  │
│  └─────────────┘     └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Capability Resolution

The agent uses capabilities to determine which tool to invoke:

| Capability | MCP Tool | Fallback (no MCP) |
|------------|----------|-------------------|
| `app-deploy` | `aio-app-deploy` | Manual `aio app deploy` instruction |
| `local-dev` | `aio-app-dev` | Manual `aio app dev` instruction |
| `action-invoke` | `aio-dev-invoke` | Manual curl/httpie call |
| `auth-login` | `aio-login` | Manual `aio login` instruction |
| `workspace-config` | `aio-configure-global` | Manual `aio app use` instruction |
| `namespace-switch` | `aio-app-use` | Manual workspace selection |

## Setup & Auto-Provisioning

When the agent detects an App Builder project (presence of `app.config.yaml`), it checks for MCP server configuration:

1. **Check MCP availability**: Look for Commerce App Builder MCP in `.mcp.json` or MCP registry
2. **Auto-install if needed**: Run `aio commerce extensibility tools-setup` to set up MCP tools
3. **Verify auth**: Ensure IMS authentication is active via `aio auth login`

### `.mcp.json` Entry (Auto-Provisioned)

```json
{
  "mcpServers": {
    "adobe-commerce-app-builder": {
      "command": "aio",
      "args": ["commerce", "extensibility", "mcp-server"],
      "env": {}
    }
  }
}
```

## Security Considerations

- MCP tools operate with the authenticated user's IMS token
- Never expose IMS tokens in generated code or logs
- All actions generated must include `require-adobe-auth: true` annotation
- MCP server respects workspace-level permissions (Dev/Stage/Prod)
- Deploy operations to Production workspace require explicit user confirmation

## Documentation References

- Installation: https://experienceleague.adobe.com/en/docs/commerce/cloud-service/migration/migration-tools/coding-tools#installation
- Tutorial: https://experienceleague.adobe.com/en/docs/commerce/cloud-service/tutorials/ratings-extension
- Support: stargriffinsextended@adobe.com
