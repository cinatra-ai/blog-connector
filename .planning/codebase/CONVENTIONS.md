# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**
- `kebab-case` for all source files: `default-connector.ts`, `legacy-converter-registry.ts`, `project-store-shape.test.ts`
- Test files mirror the source module name: `default-connector.test.ts` tests `default-connector.ts`
- One concept per file; no barrel-only re-export files except `src/index.ts`

**Functions:**
- `camelCase` for all exported functions: `registerBlogConnector`, `configureBlogSystem`, `buildBlogDraftPayloadThroughSystem`
- Private/internal helpers use `camelCase` too: `applyInlineMarkdown`, `convertMarkdownToHtml`, `flushParagraph`, `flushList`
- Factory helpers in tests are prefixed with `make` or `fake`: `makeStubStore`, `fakeConnector`

**Variables:**
- `camelCase` for locals and module-level vars
- Module-level singleton deps stored as `_deps` (underscore prefix signals internal/private)
- `_clearForTests()` underscore prefix signals test-only method on the registry class

**Types:**
- `PascalCase` for all interfaces and type aliases: `BlogConnector`, `BlogSystemDeps`, `BlogProjectStore`, `BlogDraftBuildInput`
- Suffixes encode role: `*Input` for function inputs, `*Output`/`*Result`/`*Payload` for outputs, `*Deps` for dependency injection bags, `*Store` for persistence abstractions
- `type` keyword used for aliases; `interface` used for injected dependency contracts (`BlogSystemDeps`, `BlogProjectStore`)
- All consumer imports of contract types MUST be `import type` (enforced via `import-boundary.test.ts`)

**Classes:**
- Class names use `PascalCase` with `Impl` suffix for concrete implementations of registries: `BlogConnectorRegistryImpl`
- Classes kept private to their module; exported as singleton const: `export const blogConnectorRegistry`

## Code Style

**Formatting:**
- No Prettier config detected; TypeScript strict mode (`strict: true` in `tsconfig.json`) enforces type correctness
- `verbatimModuleSyntax: true` in `tsconfig.json` — all type-only imports must use `import type`

**Linting:**
- No ESLint config detected in repo root
- One `// eslint-disable-next-line` comment found in `src/mcp/module.ts` for `any` type on structural tool-server
- TypeScript compiler options act as the primary quality gate: `isolatedModules`, `forceConsistentCasingInFileNames`

## Import Organization

**Order (observed pattern):**
1. Side-effect imports: `import "server-only"` always first
2. Node built-ins (e.g., `node:fs`, `node:path`)
3. External packages: `zod`, `@cinatra-ai/sdk-extensions`
4. Internal relative imports: `./contract`, `./registry`, `../registry`

**Path Aliases:**
- No `@/` aliases within this package (enforced: `import-boundary.test.ts` bans runtime `@/` imports)
- Only relative paths for intra-package imports

**Import type enforcement:**
- `import type` mandatory for all contract types consumed by site-specific connectors (rule documented in `src/index.ts` header comment and enforced in `src/__tests__/import-boundary.test.ts`)

## Error Handling

**Patterns:**
- Throw `Error` with a descriptive message naming the package, missing config, and the file where it should be wired: see `getDeps()` and `getProvider()` in `src/facade.ts`
- Error messages follow pattern: `"@cinatra-ai/blog-connector: <what's missing>. <How to fix it (file path)."`
- Input validation: throw `Error` inline at the point of failure (e.g., empty `articleHtml` in `src/default-connector.ts`)
- No custom error classes; no error codes
- `console.warn` for non-fatal duplicate registrations in `src/registry.ts`

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.warn` for idempotent re-registration warnings: `[blogConnectorRegistry] Replacing existing blog connector "${id}"`
- No debug/info logging in production paths; no structured log objects

## Comments

**When to Comment:**
- File-level block comments (dashes separator, package name, module purpose, calling conventions) on every source file
- Inline comments explain non-obvious intent: deduplication strategy, lazy-pull rationale, why `postMeta` is never emitted
- `// DEPRECATED:` prefix on deprecated exports with migration guidance

**JSDoc/TSDoc:**
- JSDoc `/** */` used on exported functions and types where calling conventions or constraints need explanation: `buildBlogDraftPayloadThroughSystem`, `BlogSystemDeps`, `BlogProjectStore`, `registerWordPressContentConverter`
- `@deprecated` tag used on the legacy converter registry functions

## Function Design

**Size:** Functions are small and single-purpose; largest is `convertMarkdownToHtml` in `src/default-connector.ts` (~60 lines) which manages a line-by-line parse loop with flush helpers

**Parameters:**
- Async functions accept a single typed object (`input: BlogDraftBuildInput`, `opts?: {...}`) rather than positional args
- Dependency injection via `configureBlogSystem(deps: BlogSystemDeps)` rather than constructor injection

**Return Values:**
- Async functions return typed Promise results; never `any`
- Void functions use `void` return type implicitly

## Module Design

**Exports:**
- All public API is re-exported from `src/index.ts`; consumers never import internal modules directly
- Three export surfaces: `.` (main), `./register` (server entry), `./mcp-module` (legacy MCP host path)
- `export type` for all contract types; runtime exports for functions and singleton objects

**Barrel Files:**
- `src/index.ts` is the single barrel; internal modules do not re-export each other except through `src/index.ts`
- `src/contract.ts` is a pure re-export shim pointing at `@cinatra-ai/sdk-extensions/blog-contract`

**Deprecated surface:**
- `src/legacy-converter-registry.ts` retained for `blog_wordpress_content_convert` MCP primitive compatibility; all exports annotated `@deprecated`

---

*Convention analysis: 2026-06-09*
