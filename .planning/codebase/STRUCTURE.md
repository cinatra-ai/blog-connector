# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
blog-connector/
├── src/
│   ├── __tests__/              # Vitest test files (co-located under src/)
│   │   ├── default-connector.test.ts
│   │   ├── external-resolver.test.ts
│   │   ├── import-boundary.test.ts
│   │   ├── materialize-image-shape.test.ts
│   │   ├── project-store-shape.test.ts
│   │   └── server-only-stub.ts  # Test helper: stub for server-only guard
│   ├── mcp/
│   │   └── module.ts           # MCP module barrel (server-only stub)
│   ├── contract.ts             # Contract type re-exports from sdk-extensions
│   ├── default-connector.ts    # Bundled generic WordPress connector
│   ├── facade.ts               # Provider-agnostic publish facade + BlogSystemDeps
│   ├── index.ts                # Package public API surface
│   ├── legacy-converter-registry.ts  # DEPRECATED per-instance converter map
│   ├── register.ts             # Extension server entry; registers MCP tools
│   └── registry.ts             # In-memory BlogConnector registry singleton
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # CI workflow
│   │   └── release.yml         # Release workflow
├── LICENSE                     # Apache-2.0
├── README.md
├── package.json                # Package manifest; cinatra extension metadata
├── tsconfig.json               # TypeScript config
└── vitest.config.ts            # Vitest test runner config
```

## Directory Purposes

**`src/`:**
- Purpose: All source and test code
- Contains: TypeScript modules (.ts); no subdirectory beyond `mcp/` and `__tests__/`
- Key files: `index.ts` (public API), `facade.ts` (publish chokepoint), `registry.ts` (connector store)

**`src/__tests__/`:**
- Purpose: All Vitest tests for this package
- Contains: `*.test.ts` files and test helpers (e.g. `server-only-stub.ts`)
- Key files: `default-connector.test.ts`, `external-resolver.test.ts`, `import-boundary.test.ts`

**`src/mcp/`:**
- Purpose: MCP module sub-path export (`@cinatra-ai/blog-connector/mcp-module`)
- Contains: `module.ts` — currently a `server-only` guard stub
- Key files: `module.ts`

**`.github/workflows/`:**
- Purpose: CI and release automation
- Contains: `ci.yml`, `release.yml`

## Key File Locations

**Entry Points:**
- `src/index.ts`: Primary package export (`"."` export map entry)
- `src/register.ts`: Extension server entry (`"./register"` export map entry); called by extension host at boot
- `src/mcp/module.ts`: MCP module export (`"./mcp-module"` export map entry)

**Configuration:**
- `package.json`: Package identity, dependencies, export map, and `cinatra` extension metadata block (`kind: connector`, `serverEntry`, `requestedHostPorts`, `sdkAbiRange`)
- `tsconfig.json`: TypeScript compiler options
- `vitest.config.ts`: Test runner configuration

**Core Logic:**
- `src/facade.ts`: `configureBlogSystem`, `buildBlogDraftPayloadThroughSystem`, `materializeBlogImageThroughSystem`, `getBlogProjectStore`
- `src/registry.ts`: `BlogConnectorRegistryImpl` singleton; `registerBlogConnector`, `listInstalledBlogConnectors`
- `src/default-connector.ts`: `defaultBlogConnector` — bundled generic connector with inline markdown→HTML converter
- `src/contract.ts`: Re-exports all contract types from `@cinatra-ai/sdk-extensions/blog-contract`

**Testing:**
- `src/__tests__/*.test.ts`: All tests live here

## Naming Conventions

**Files:**
- `kebab-case.ts` for all source modules (e.g. `default-connector.ts`, `legacy-converter-registry.ts`)
- `kebab-case.test.ts` for test files
- `server-only-stub.ts` naming convention for test helpers that mock `server-only`

**Directories:**
- `__tests__/` for test files (double-underscore Jest/Vitest convention)
- `mcp/` for MCP sub-path exports

**Exports:**
- PascalCase for types and interfaces (e.g. `BlogConnector`, `BlogSystemDeps`, `BlogProjectStore`)
- camelCase for functions and singletons (e.g. `registerBlogConnector`, `blogConnectorRegistry`, `defaultBlogConnector`)
- SCREAMING_SNAKE_CASE: not used

## Where to Add New Code

**New BlogConnector implementation (bundled):**
- Implementation: `src/` as a new `kebab-name-connector.ts` (e.g. `src/my-connector.ts`)
- Export from: `src/index.ts` under the `// ── Default generic connector` or a new named section
- Register at boot: host's `src/lib/register-blog-providers.ts` via `registerBlogConnector`

**New facade capability (host-injected dep):**
- Widen `BlogSystemDeps` interface in `src/facade.ts`
- Add accessor function in `src/facade.ts` (follow pattern of `getBlogProjectStore`)
- Export new type from `src/index.ts`

**New MCP tool:**
- Add `ctx.mcp.registerTool(…)` call inside `register(ctx)` in `src/register.ts`
- Input schema: Zod object defined at module top-level in `register.ts`

**New tests:**
- Location: `src/__tests__/kebab-description.test.ts`
- If the test needs to bypass `server-only`, import from `src/__tests__/server-only-stub.ts`

**Utilities (shared helpers):**
- If scoped to one module, keep inline in that module
- If shared across modules, create `src/utils.ts` (no `utils/` directory currently exists)

## Special Directories

**`.github/`:**
- Purpose: GitHub Actions workflows for CI and release
- Generated: No
- Committed: Yes

**`src/__tests__/`:**
- Purpose: All package tests; includes `server-only-stub.ts` helper
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-06-09*
