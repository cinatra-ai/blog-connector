# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Deprecated legacy converter registry still exported:**
- Issue: `registerWordPressContentConverter` / `getWordPressContentConverter` are explicitly marked `@deprecated` but remain in the public surface (`src/index.ts` re-exports them). They exist only to keep the dormant `blog_wordpress_content_convert` asset-blog MCP primitive alive. Until that primitive is retired the surface cannot be removed, creating a permanent backward-compat tax on every consumer.
- Files: `src/legacy-converter-registry.ts`, `src/index.ts`
- Impact: Consumers see deprecated APIs in autocomplete; any new connector author may accidentally use the old path instead of `BlogConnector`. The per-instance `Map<string, WordPressContentConverterFn>` is a separate singleton from `blogConnectorRegistry`, so the two registries can diverge silently.
- Fix approach: Retire the `blog_wordpress_content_convert` MCP primitive (or port it to the `BlogConnector` contract), then remove `legacy-converter-registry.ts` and its re-exports from `src/index.ts`.

**Dual MCP registration paths for `blog_connector_list`:**
- Issue: The tool is registered both via `src/mcp/module.ts` (`registerBlogPrimitives` → host-static) and via `src/register.ts` (`register(ctx)` → IoC / SDK path). The comment in `src/register.ts` calls the host-static path "the production-serving path until the host→connector cutover retires it." That cutover has not happened.
- Files: `src/register.ts`, `src/mcp/module.ts`
- Impact: Both registrations run in production; the host dedupes by tool name (accepted risk per the comment), but any divergence in schema or response shape between the two files will cause a silent mismatch until dedup logic changes.
- Fix approach: Complete the host→connector cutover, make `src/register.ts` the sole registration path, and delete `src/mcp/module.ts`.

**`noImplicitAny: false` in tsconfig despite `strict: true`:**
- Issue: `tsconfig.json` sets `"strict": true` and then explicitly overrides `"noImplicitAny": false`. This weakens TypeScript's type safety — implicit `any` bindings are permitted across the entire codebase.
- Files: `tsconfig.json`
- Impact: Type errors can be silently swallowed; the `eslint-disable @typescript-eslint/no-explicit-any` in `src/mcp/module.ts` is a symptom of the same looseness.
- Fix approach: Remove `"noImplicitAny": false` (let `strict` enable it), then fix the one known `any` in `src/mcp/module.ts` — `BlogToolServer.registerTool` should be typed against the structural SDK type or a narrower structural shape.

**`BlogToolServer` typed as `any` in the structural stub:**
- Issue: `src/mcp/module.ts` defines `BlogToolServer.registerTool(...args: any[]): unknown` with an explicit eslint-disable comment. This is the only occurrence of `any` in the source tree.
- Files: `src/mcp/module.ts` (line 22)
- Impact: Type errors in `registerBlogPrimitives` callers are invisible. When the host-static path is finally retired this becomes irrelevant, but until then it's a real gap.
- Fix approach: Import the structural type from `@cinatra-ai/sdk-extensions` or define a narrower typed interface for `registerTool`.

## Known Bugs

**Heading level shift in `convertMarkdownToHtml` is always +2:**
- Issue: In `src/default-connector.ts` the heading level is bumped by +2 unconditionally (`const level = Math.min(6, sourceLevel + 2)`). A `# H1` in source would become `<h3>`, `## H2` becomes `<h4>`, etc. However `#` (level 1) is excluded by the regex `#{2,6}`, so the minimum heading in output is `<h4>` from a `## H2` input.
- Files: `src/default-connector.ts` (~line 79)
- Impact: An author using `## Section` as a top-level heading gets `<h4>` in WordPress, not `<h2>`. This is likely intentional (WordPress uses `<h1>` for the post title), but is undocumented and may surprise connector consumers.
- Workaround: Callers can pass `contentIsHtml: true` and pre-render their own HTML.

**`convertMarkdownToHtml` does not handle flushing at end-of-input for mixed list types:**
- Issue: `flushList()` is called at blank lines and at heading/raw-HTML boundaries, and at the very end of the loop body (`flushParagraph(); flushList()` at end). However if the last lines of a document are a mix of ordered and unordered list items (no blank line at EOF), `orderedItems` or `listItems` will always be reset to `[]` by the sibling list-type flush inside `flushList`, which only flushes the non-empty one. The second type is then flushed correctly. This is actually fine but fragile — the logic relies on never having both `listItems` and `orderedItems` populated at the same time, which the code enforces by `orderedItems = []` / `listItems = []` on each respective match. No actual bug, but the implicit invariant is unenforced by types.
- Files: `src/default-connector.ts`
- Impact: Low. Would surface as a rendering glitch only if the invariant is ever broken by future edits.

## Security Considerations

**`server-only` guard relies on the bundler/Next.js RSC graph:**
- Risk: Every runtime file (`src/facade.ts`, `src/registry.ts`, `src/default-connector.ts`, `src/mcp/module.ts`, `src/register.ts`) starts with `import "server-only"`. This guard works only when the consuming application uses Next.js App Router (or another RSC-aware bundler that resolves `server-only` to a throw). In a plain Node.js / Vitest context the stub (`src/__tests__/server-only-stub.ts`) suppresses the throw deliberately.
- Files: `src/__tests__/server-only-stub.ts`, `vitest.config.ts`
- Current mitigation: The `server-only` package itself throws at import time in a non-RSC environment. The vitest alias is scoped to the test environment only.
- Recommendations: No change needed; the guard is correct. Document that this package must not be imported in any client-side bundle.

**`.npmrc` sets `auto-install-peers=false`:**
- Risk: Peer dependencies (including `@cinatra-ai/sdk-extensions`) are not auto-installed. A consumer who installs the package in a standalone context outside the monorepo will silently lack the SDK.
- Files: `.npmrc`
- Current mitigation: The CI `classify` step detects that `@cinatra-ai/sdk-extensions` is an optional peer and skips standalone install/test, documenting the monorepo-only constraint explicitly.
- Recommendations: Acceptable for a source-mirror pattern; ensure README documents the monorepo-only install requirement.

## Performance Bottlenecks

**In-memory singleton registry with no capacity limit:**
- Problem: `BlogConnectorRegistryImpl` in `src/registry.ts` stores all registered connectors in a `Map` with no eviction or size cap.
- Files: `src/registry.ts`
- Cause: Not a real concern at the expected scale (single-digit connectors per deployment). Noted for completeness.
- Improvement path: Not applicable unless connector counts grow into the hundreds.

**`listAll()` performs a full merge on every call:**
- Problem: `blogConnectorRegistry.listAll()` rebuilds the merged `Map` from scratch on every call, including a full iteration over `this.externalResolver?.()`.
- Files: `src/registry.ts` (~line 52)
- Cause: Intentional — the resolver must be pulled lazily to reflect teardowns. Caching would re-introduce the stale-connector risk the design was built to avoid.
- Improvement path: Acceptable; the external resolver list is expected to be small.

## Fragile Areas

**`_deps` module-level singleton in `src/facade.ts`:**
- Files: `src/facade.ts` (the `let _deps: BlogSystemDeps | null = null` singleton)
- Why fragile: `configureBlogSystem` replaces `_deps` unconditionally. In test suites that call `configureBlogSystem` multiple times (e.g., `materialize-image-shape.test.ts` and `project-store-shape.test.ts` both call it without cleanup), the last call wins and earlier test runs may see stale state if test order changes. There is no `resetBlogSystem()` equivalent of `_clearForTests()` on the registry.
- Safe modification: Always call `configureBlogSystem` in a `beforeEach` when writing facade tests. Add a `_resetDepsForTests()` export behind a test-only guard if cross-test pollution is observed.
- Test coverage: The shape-gate tests cover the throw-on-missing path but do not test isolation between test cases.

**`register.ts` depends on `ExtensionHostContext` from `@cinatra-ai/sdk-extensions`:**
- Files: `src/register.ts`
- Why fragile: This is an optional peer dependency. If the host does not provide `@cinatra-ai/sdk-extensions`, importing `src/register.ts` will throw a module-not-found error at runtime. The CI skip logic handles this for standalone CI runs, but any consumer outside the monorepo who imports `./register` directly will get an opaque crash.
- Safe modification: Gate the import behind a try/catch or document the hard monorepo requirement prominently.

## Scaling Limits

**Single in-memory registry, no persistence:**
- Current capacity: Unbounded (Map); realistic load is 2–5 connectors per host process.
- Limit: Registry is reset on process restart; no cross-process sharing.
- Scaling path: Not applicable for the connector-per-deployment model. If a multi-tenant SaaS model ever requires per-tenant connector sets, a scoped registry per tenant context would be needed.

## Dependencies at Risk

**`zod` pinned to `^4.4.3` (major version 4):**
- Risk: Zod v4 is a significant API break from v3. Consumers still on Zod v3 who install this package will get a peer/dep conflict if they share the same Zod instance.
- Files: `package.json`
- Impact: Schema validation in `src/register.ts` and `src/mcp/module.ts` (`blogConnectorListInputSchema = z.object({})`) would fail at runtime if the host resolves an incompatible Zod version.
- Migration plan: Since the schema in this package is trivially `z.object({})`, the Zod dependency could be removed entirely and the input typed as `Record<string, never>`, eliminating the version risk.

**`vitest` pinned to `^4.1.6` (major version 4):**
- Risk: Vitest 4 is a recent major; the broader ecosystem has more tooling tested against v3. Not a production risk (devDependency only), but may create friction if the monorepo workspace is on v3.
- Files: `package.json`
- Impact: Dev-only.
- Migration plan: Align with monorepo vitest version.

## Missing Critical Features

**No `configureBlogSystem` reset / teardown API:**
- Problem: There is no `resetBlogSystem()` or `teardownBlogSystem()` export. Once `configureBlogSystem` is called with a given `deps`, the only way to reset state is `_clearForTests()` on the registry (which does not reset `_deps`).
- Blocks: Safe test isolation in suites that reconfigure the facade across multiple tests.

**No TypeScript path for `#1`-level headings in `convertMarkdownToHtml`:**
- Problem: The markdown parser's regex `#{2,6}` explicitly excludes `#` (H1). A document using a single `# Title` heading will have the heading silently treated as a paragraph.
- Blocks: Markdown documents with H1 headings are silently misrendered.

## Test Coverage Gaps

**`src/register.ts` has zero test coverage:**
- What's not tested: The IoC `register(ctx)` path — `ExtensionHostContext.mcp.registerTool` invocation, the handler return value shape, and the input schema.
- Files: `src/register.ts`
- Risk: A regression in the `register` function (e.g., wrong field name, schema change) would pass CI undetected until the monorepo integration tests catch it.
- Priority: Medium

**`src/legacy-converter-registry.ts` has zero test coverage:**
- What's not tested: `registerWordPressContentConverter`, `getWordPressContentConverter`, unknown-id lookup returning `undefined`.
- Files: `src/legacy-converter-registry.ts`
- Risk: Low (the surface is deprecated and dormant), but a breaking change to the export shape would go unnoticed.
- Priority: Low

**`configureBlogSystem` → `resolveConnectorId` routing chain not tested end-to-end:**
- What's not tested: `buildBlogDraftPayloadThroughSystem` with a real `resolveConnectorId` → `blogConnectorRegistry.get()` → `connector.buildDraftPayload()` full round-trip. Current tests stub the connector directly or test the facade shape in isolation.
- Files: `src/facade.ts`, `src/__tests__/materialize-image-shape.test.ts`, `src/__tests__/project-store-shape.test.ts`
- Risk: A regression in `getProvider` error messaging or connector resolution priority (explicit > instance > default) would not be caught.
- Priority: Medium

**`convertMarkdownToHtml` edge cases not covered:**
- What's not tested: H1-level heading (`#`) silently becoming a paragraph, nested inline markdown (bold inside a link), HTML pass-through lines, empty content throwing the expected error.
- Files: `src/default-connector.ts`, `src/__tests__/default-connector.test.ts`
- Risk: Medium — the markdown converter is custom-built with no battle-tested library backing it; edge cases accumulate.
- Priority: Medium

---

*Concerns audit: 2026-06-09*
