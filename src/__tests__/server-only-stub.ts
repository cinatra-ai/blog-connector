// Vitest-only stub for `server-only`. The real module throws on import in
// client builds; in our Node test environment the throw is irrelevant
// (vitest is not an RSC client graph) but `tsgo`/`tsc`-via-Next still
// follows the import. Aliased via vitest.config.ts.
export {};
