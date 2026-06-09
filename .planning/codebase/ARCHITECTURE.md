<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Host Application                          │
│  (src/lib/register-blog-providers.ts in host repo)           │
│   configureBlogSystem(deps)  ·  registerBlogConnector(c)     │
└──────────────┬──────────────────────────┬───────────────────┘
               │ boot                     │ publish
               ▼                          ▼
┌─────────────────────────┐  ┌────────────────────────────────┐
│       registry.ts        │  │           facade.ts             │
│  BlogConnectorRegistry   │◄─│  buildBlogDraftPayloadThrough   │
│  (in-memory singleton +  │  │  System(input, opts)           │
│   externalResolver hook) │  │  materializeBlogImageThrough   │
└─────────────────────────┘  │  System(input)                 │
               ▲             │  getBlogProjectStore()          │
               │             └────────────┬───────────────────┘
               │ register                 │ delegate
               │                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  BlogConnector implementation                 │
│   default-connector.ts  (connectorId: "default")             │
│   @oss-flywheel/blog-connector  (external, Elementor)        │
│   …vendor-scoped connectors registered at boot…              │
└──────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│           WordPress REST API (via host)                       │
│   createWordPressDraft(createPayload)                         │
│   updateWordPressDraftMeta({meta: postMeta})                  │
└──────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `contract.ts` | Re-exports all public contract types from `@cinatra-ai/sdk-extensions/blog-contract` | `src/contract.ts` |
| `registry.ts` | In-memory singleton `BlogConnectorRegistryImpl`; register/get/listAll with external-resolver hook | `src/registry.ts` |
| `facade.ts` | Single chokepoint for publish flow; holds module-level `_deps`; routes calls to correct connector | `src/facade.ts` |
| `default-connector.ts` | Generic WordPress connector: markdown→HTML conversion, no vendor logic, never produces `postMeta` | `src/default-connector.ts` |
| `register.ts` | `register(ctx)` server entry; registers `blog_connector_list` MCP tool via `ctx.mcp.registerTool` | `src/register.ts` |
| `mcp/module.ts` | MCP module barrel (`server-only` guard; `register` re-export lives in `register.ts`) | `src/mcp/module.ts` |
| `legacy-converter-registry.ts` | **DEPRECATED** per-instance `WordPressContentConverterFn` map; retained only for `blog_wordpress_content_convert` MCP primitive | `src/legacy-converter-registry.ts` |
| `index.ts` | Public surface: re-exports contract types, registry functions, facade functions, defaultBlogConnector, legacy types | `src/index.ts` |

## Pattern Overview

**Overall:** Plugin/Registry pattern with host-injected dependency facade

**Key Characteristics:**
- All server-side modules are guarded by `import "server-only"` to prevent accidental client bundle inclusion
- The host application is responsible for wiring: it calls `configureBlogSystem(deps)` at boot and registers connectors via `registerBlogConnector`
- The registry supports two connector populations: locally-registered (explicit) and host-injected via `externalResolver` (hot-installed vendors); local always wins on id collision
- The facade holds a module-level `_deps` singleton; it is never imported by connector implementations — only by the host
- Contract types all originate from `@cinatra-ai/sdk-extensions/blog-contract`; `contract.ts` is a pure re-export

## Layers

**Contract Layer:**
- Purpose: Shared type definitions (BlogConnector, BlogDraftBuildInput, BlogDraftPayload, etc.)
- Location: `src/contract.ts` (re-exports from `@cinatra-ai/sdk-extensions/blog-contract`)
- Contains: TypeScript `export type` only — zero runtime code
- Depends on: `@cinatra-ai/sdk-extensions`
- Used by: All other layers; external connector packages use `import type` only

**Registry Layer:**
- Purpose: In-memory map of registered BlogConnector implementations
- Location: `src/registry.ts`
- Contains: `BlogConnectorRegistryImpl` class, exported singleton `blogConnectorRegistry`, `registerBlogConnector`, `listInstalledBlogConnectors`
- Depends on: `contract.ts`
- Used by: `facade.ts`, `register.ts`

**Facade Layer:**
- Purpose: Provider-agnostic chokepoint for all publish operations; holds host-injected deps
- Location: `src/facade.ts`
- Contains: `configureBlogSystem`, `buildBlogDraftPayloadThroughSystem`, `materializeBlogImageThroughSystem`, `getBlogProjectStore`; type definitions `BlogSystemDeps`, `BlogImageMaterializeInput`, `BlogImageMaterializeResult`, `BlogProjectStore`, `BlogProjectSummary`
- Depends on: `registry.ts`, `contract.ts`
- Used by: Host application only

**Connector Implementation Layer:**
- Purpose: Vendor-specific or generic draft-building logic
- Location: `src/default-connector.ts` (bundled default); external packages (e.g. `@oss-flywheel/blog-connector`)
- Contains: Objects satisfying the `BlogConnector` interface; `buildDraftPayload(input) → BlogDraftPayload`
- Depends on: `contract.ts`
- Used by: Registered into `registry.ts`; invoked by `facade.ts`

**MCP/Extension Layer:**
- Purpose: Expose blog capabilities as MCP tools to the host's tool registry
- Location: `src/register.ts`, `src/mcp/module.ts`
- Contains: `register(ctx: ExtensionHostContext)` which registers `blog_connector_list` tool
- Depends on: `registry.ts`, `@cinatra-ai/sdk-extensions`
- Used by: Extension host at boot via `"serverEntry": "./register"` in `package.json`

**Legacy Layer:**
- Purpose: Dormant backwards-compatibility surface for `blog_wordpress_content_convert` MCP primitive
- Location: `src/legacy-converter-registry.ts`
- Contains: Per-instance `Map<string, WordPressContentConverterFn>`; `registerWordPressContentConverter`, `getWordPressContentConverter`
- Depends on: Nothing
- Used by: Host's `blog_wordpress_content_convert` primitive only; DEPRECATED — no new registrations

## Data Flow

### Primary Publish Path

1. Host calls `configureBlogSystem(deps)` at boot — wires `resolveConnectorId`, `materializeBlogImage`, `projectStore`, optional `resolveConnectorProviders` (`src/facade.ts:configureBlogSystem`)
2. Site-specific connector package calls `registerBlogConnector(connector)` at boot (`src/registry.ts:register`)
3. Host calls `buildBlogDraftPayloadThroughSystem(input, { instanceBlogConnectorId })` (`src/facade.ts`)
4. Facade calls `deps.resolveConnectorId({ explicitConnectorId, instanceBlogConnectorId })` — host resolves priority: explicit > instance default > "default"
5. Facade calls `blogConnectorRegistry.get(connectorId)` — checks local entries then `externalResolver` fallback (`src/registry.ts:get`)
6. Facade calls `connector.buildDraftPayload(input)` → returns `{ createPayload, postMeta? }`
7. Host calls `createWordPressDraft(createPayload)` and optionally `updateWordPressDraftMeta({ meta: postMeta })`

### Image Materialization Path

1. Host calls `materializeBlogImageThroughSystem(input)` (`src/facade.ts`)
2. Facade delegates to `deps.materializeBlogImage(input)` — host-injected semantic-artifact pipeline
3. Returns `{ artifactId, representationRevisionId }`

### MCP Tool Registration Path

1. Extension host loads `"serverEntry": "./register"` from `package.json`
2. Host calls `register(ctx)` in `src/register.ts`
3. `register` calls `ctx.mcp.registerTool({ name: "blog_connector_list", … })`
4. Tool handler returns `listInstalledBlogConnectors()` mapped to definition fields

**State Management:**
- Module-level `_deps: BlogSystemDeps | null` singleton in `src/facade.ts` — set once by `configureBlogSystem`, read by every facade function
- Module-level `BlogConnectorRegistryImpl` singleton in `src/registry.ts` — mutable Map plus optional external resolver; `_clearForTests()` resets both

## Key Abstractions

**BlogConnector:**
- Purpose: Interface a connector implementation must satisfy — `definition: BlogConnectorDefinition` + `buildDraftPayload(input): Promise<BlogDraftPayload>`
- Examples: `src/default-connector.ts` (bundled), `@oss-flywheel/blog-connector` (external)
- Pattern: Object literal satisfying interface; registered into `blogConnectorRegistry` at boot

**BlogSystemDeps:**
- Purpose: Dependency injection bag the host passes to `configureBlogSystem`; keeps facade DB-agnostic
- Examples: `src/facade.ts` (interface definition)
- Pattern: Plain interface with required `resolveConnectorId` and optional `materializeBlogImage`, `projectStore`, `resolveConnectorProviders`

**externalResolver:**
- Purpose: Lazy hook for connectors registered out-of-band via capability registry (hot-installed vendors); pulled on every read so teardown is immediately reflected
- Examples: `src/registry.ts:setExternalResolver`, `src/facade.ts:configureBlogSystem`
- Pattern: `() => readonly BlogConnector[]` callback injected by host; never cached into `entries` Map

## Entry Points

**Package Public API:**
- Location: `src/index.ts`
- Triggers: `import { … } from "@cinatra-ai/blog-connector"`
- Responsibilities: Re-exports all public types and runtime symbols

**Server Entry (Extension Host):**
- Location: `src/register.ts`
- Triggers: Extension host loads `"serverEntry": "./register"` and calls `register(ctx)`
- Responsibilities: Registers `blog_connector_list` MCP tool

**MCP Module Export:**
- Location: `src/mcp/module.ts`
- Triggers: `import … from "@cinatra-ai/blog-connector/mcp-module"`
- Responsibilities: Currently a `server-only` stub; module barrel for future MCP expansion

## Architectural Constraints

- **Server-only:** All runtime modules (`facade.ts`, `registry.ts`, `default-connector.ts`, `register.ts`) import `"server-only"` — this package cannot be imported in browser/client bundles
- **No host imports:** Connector implementations (including `default-connector.ts`) must never import host-side modules (`@/lib/*`); host logic is injected through `BlogSystemDeps`
- **Types from SDK:** All contract types originate in `@cinatra-ai/sdk-extensions/blog-contract`; `contract.ts` is a pure re-export pass-through
- **Global state:** Two module-level singletons — `_deps` in `src/facade.ts` and `blogConnectorRegistry` in `src/registry.ts`
- **Circular imports:** None detected; dependency order is contract → registry → facade → (no reverse)
- **ESM only:** `"type": "module"` in `package.json`; no CJS interop

## Anti-Patterns

### Importing from host inside a connector

**What happens:** A connector implementation imports `@/lib/...` or any host-scoped path to access database or config
**Why it's wrong:** Breaks the inversion-of-control design; connectors become host-coupled and untestable in isolation
**Do this instead:** Add the required data to `BlogDraftBuildInput` (in `@cinatra-ai/sdk-extensions/blog-contract`) or inject a new dep through `BlogSystemDeps` in `src/facade.ts`

### Registering new logic in legacy-converter-registry

**What happens:** New site-specific conversion logic is added via `registerWordPressContentConverter`
**Why it's wrong:** `legacy-converter-registry.ts` is explicitly deprecated; `blog_wordpress_content_convert` MCP primitive is slated for retirement
**Do this instead:** Implement `BlogConnector` (satisfying `src/contract.ts`), register via `registerBlogConnector`, bind via `configureBlogSystem`

## Error Handling

**Strategy:** Throw with descriptive messages that include the call-site fix path

**Patterns:**
- `getDeps()` throws `"blog system not configured. Call configureBlogSystem(deps) at boot"` if `_deps` is null
- `getProvider(id)` throws listing all registered connector IDs so the caller can diagnose a missing registration
- `materializeBlogImageThroughSystem` and `getBlogProjectStore` throw if their respective optional dep is not wired in `configureBlogSystem`

## Cross-Cutting Concerns

**Logging:** `console.warn` only — emitted by `blogConnectorRegistry.register` when a connector ID is replaced
**Validation:** Zod schema (`blogConnectorListInputSchema`) used for MCP tool input in `src/register.ts`; no runtime validation on `buildDraftPayload` inputs beyond TypeScript types
**Authentication:** Not applicable — this package is facade/registry only; auth is handled by the host application before calling facade functions

---

*Architecture analysis: 2026-06-09*
