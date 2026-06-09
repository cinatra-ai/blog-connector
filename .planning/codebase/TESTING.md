# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:**
- Vitest ^4.1.6
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`)

**Run Commands:**
```bash
npm test              # Run all tests (vitest run — no watch)
```

No watch or coverage scripts defined in `package.json`. Run coverage manually with:
```bash
npx vitest run --coverage
```

## Test File Organization

**Location:**
- Co-located under `src/__tests__/` directory — all test files in one flat directory regardless of which source module they target

**Naming:**
- `<source-module-name>.test.ts` for behavioral tests: `default-connector.test.ts`, `external-resolver.test.ts`
- `<concept>-shape.test.ts` for facade shape/contract gate tests: `materialize-image-shape.test.ts`, `project-store-shape.test.ts`
- `import-boundary.test.ts` for static import enforcement
- `server-only-stub.ts` is a test-support file (not a test itself), aliased via `vitest.config.ts`

**Structure:**
```
src/
  __tests__/
    default-connector.test.ts       # unit: markdown→HTML, payload shape
    external-resolver.test.ts       # unit: registry merge + lazy teardown
    import-boundary.test.ts         # static: no forbidden runtime imports
    materialize-image-shape.test.ts # facade shape gate: materializeBlogImage dep
    project-store-shape.test.ts     # facade shape gate: projectStore dep
    server-only-stub.ts             # vitest alias stub for `server-only`
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("<module>.<method> (<short description>)", () => {
  beforeEach(() => {
    blogConnectorRegistry._clearForTests(); // reset singleton state
  });

  it("<plain English assertion>", async () => {
    // arrange → act → expect
    expect(result.field).toBe(value);
  });
});
```

**Patterns:**
- `beforeEach` used only when a shared singleton needs resetting (`blogConnectorRegistry._clearForTests()`)
- No `afterEach`/`afterAll` teardown — tests reset state at the start of each case via `beforeEach`
- Arrange-act-assert inline within each `it` block; no shared setup helpers except `beforeEach`
- Descriptive `it` strings use plain English stating the observable outcome, not implementation detail

## Mocking

**Framework:** No mock library (no `vi.mock`, no `vi.fn()` used in any test file)

**Patterns:**
```typescript
// Hand-written stub objects implementing the interface:
function fakeConnector(id: string): BlogConnector {
  return {
    definition: { connectorId: id, name: id, slug: id, ... },
    buildDraftPayload: async () => ({ createPayload: { ... } }),
  } as unknown as BlogConnector;
}

// Stub with call tracking (array push):
function makeStubStore(): BlogProjectStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    listProjects: async () => { calls.push("listProjects"); return [...]; },
    getProject: async (id) => { calls.push(`getProject:${id}`); return ...; },
  };
}

// Capture array for verifying calls:
const calls: BlogImageMaterializeInput[] = [];
const deps: BlogSystemDeps = {
  materializeBlogImage: async (input) => { calls.push(input); return expected; },
};
```

**What to Mock:**
- `server-only` package — aliased to `src/__tests__/server-only-stub.ts` via `vitest.config.ts` so RSC-guard modules load in Node test context
- Host-injected deps (`BlogSystemDeps`) — always replaced with hand-written stubs via `configureBlogSystem(deps)`
- External resolvers passed to `blogConnectorRegistry.setExternalResolver()`

**What NOT to Mock:**
- The module under test itself — always import the real implementation
- The registry singleton — reset it with `_clearForTests()` rather than replacing it

## Fixtures and Factories

**Test Data:**
```typescript
// Inline literal objects for simple cases:
const result = await defaultBlogConnector.buildDraftPayload({
  postTitle: "Hello",
  postExcerpt: "world",
  blogPostContent: "## A heading\n\nA paragraph with **bold** text.",
});

// Named sample constant for reuse across cases in the same file:
const SAMPLE: BlogProjectSummary = {
  id: "p1",
  name: "Blog 1",
  companyUrl: "https://example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
```

**Location:**
- Fixtures are inline in each test file; no shared fixture files or `__fixtures__/` directory

## Coverage

**Requirements:** None enforced — no coverage threshold in `vitest.config.ts`

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- All 5 test files are unit tests
- No network, no DB, no filesystem writes (except `import-boundary.test.ts` which reads source files via `node:fs`)
- Each test file targets one concern: connector behavior, registry merge semantics, import hygiene, or facade shape contracts

**Integration Tests:**
- Not applicable — no integration test layer exists

**E2E Tests:**
- Not used

## Common Patterns

**Async Testing:**
```typescript
it("delegates to deps.materializeBlogImage with the input payload", async () => {
  const result = await materializeBlogImageThroughSystem({ imageBase64: "AAAA", imageMimeType: "image/png" });
  expect(result).toEqual(expected);
});
```

**Error Testing:**
```typescript
// Async throw:
await expect(
  materializeBlogImageThroughSystem({ imageBase64: "AAAA", imageMimeType: "image/png" }),
).rejects.toThrow(/materializeBlogImage/);

// Sync throw:
expect(() => getBlogProjectStore()).toThrow(/projectStore/);
```

**Static Import Boundary Test:**
```typescript
// import-boundary.test.ts walks src/ with node:fs, finds all runtime import
// specifiers, and asserts none match FORBIDDEN_PATTERNS (e.g. @/-aliases,
// vendor connector packages). Runs as a normal vitest `it` block.
```

**Lazy/Teardown Behavior Test:**
```typescript
it("is LAZY — a teardown is reflected immediately; nothing is cached", () => {
  let live: BlogConnector[] = [fakeConnector("transient")];
  blogConnectorRegistry.setExternalResolver(() => live);
  expect(blogConnectorRegistry.get("transient")).not.toBeNull();

  live = []; // simulate invalidateProvidersForPackage
  expect(blogConnectorRegistry.get("transient")).toBeNull();
});
```

## Vitest Alias Configuration

`vitest.config.ts` aliases `server-only` to `src/__tests__/server-only-stub.ts`:
```typescript
alias: {
  "server-only": new URL("./src/__tests__/server-only-stub.ts", import.meta.url).pathname,
},
```
This is required for any test that imports a module with `import "server-only"` at the top (`src/registry.ts`, `src/facade.ts`, `src/default-connector.ts`). The stub is an empty `export {}`.

---

*Testing analysis: 2026-06-09*
