# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Cinatra SDK / Extension Host:**
- `@cinatra-ai/sdk-extensions` — the host platform SDK; provides `ExtensionHostContext` (used in `src/register.ts`) and the `blog-contract` sub-path (`@cinatra-ai/sdk-extensions/blog-contract`) re-exported through `src/contract.ts`
  - SDK/Client: peer dependency `@cinatra-ai/sdk-extensions`
  - Auth: not applicable — resolved at workspace level, no API key

**MCP (Model Context Protocol):**
- The package registers an MCP tool (`blog_connector_list`) via `ctx.mcp.registerTool` in `src/register.ts`
- The host's MCP port is declared in `package.json` under `cinatra.requestedHostPorts: ["mcp"]`
- MCP module stub at `src/mcp/module.ts` (server-only guard only; tool registration happens in `src/register.ts`)

**WordPress / CMS Sites (indirect):**
- No direct HTTP calls in this package; the connector interface (`BlogConnector`) defines the contract that site-specific connector packages (e.g. `@oss-flywheel/blog-connector`) implement to talk to WordPress or other CMSes
- The `defaultBlogConnector` exported from `src/default-connector.ts` targets a generic WordPress path

## Data Storage

**Databases:**
- Not applicable — this package has no direct database client or connection

**File Storage:**
- Not applicable

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Not applicable — this package has no auth logic; authentication is handled by the host platform and site-specific connector implementations

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- Not detected — no logging framework imported; any logging deferred to host

## CI/CD & Deployment

**Hosting:**
- Published as an npm package (`@cinatra-ai/blog-connector`); consumed via pnpm workspace or registry

**CI Pipeline:**
- GitHub Actions: `.github/workflows/ci.yml` (build/test), `.github/workflows/release.yml` (release)

## Environment Configuration

**Required env vars:**
- None detected in source code

**Secrets location:**
- Not applicable — no secrets in this package

## Webhooks & Callbacks

**Incoming:**
- Not applicable — library package, no HTTP server

**Outgoing:**
- Not applicable — no outbound HTTP calls in this package; delegates to host and site-specific connectors

---

*Integration audit: 2026-06-09*
