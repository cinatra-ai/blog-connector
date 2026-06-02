// ---------------------------------------------------------------------------
// @cinatra-ai/blog-connector — public surface.
//
// Contract types: BlogConnector capability interface +
// BlogDraftBuildInput / BlogDraftPayload / BlogDraftCreatePayload /
// BlogConnectorId. Re-exports BlogConnectorDefinition from sdk-extensions.
//
// Runtime facade: registerBlogConnector, configureBlogSystem,
// buildBlogDraftPayloadThroughSystem, listInstalledBlogConnectors,
// BlogSystemDeps. Plus `defaultBlogConnector` (generic WP path).
//
// Consumption rule: site-specific connector packages (e.g.
// @oss-flywheel/blog-connector) import BlogConnector / BlogDraftBuildInput /
// BlogDraftPayload as `import type` only.
// ---------------------------------------------------------------------------

// ── Contract types ────────────────────────────────────────────────────────

export type {
  BlogConnector,
  BlogConnectorId,
  BlogDraftBuildInput,
  BlogDraftCreatePayload,
  BlogDraftPayload,
} from "./contract";

export type { BlogConnectorDefinition } from "@cinatra-ai/sdk-extensions";

// ── Runtime facade ────────────────────────────────────────────────────────

export {
  registerBlogConnector,
  listInstalledBlogConnectors,
  blogConnectorRegistry,
} from "./registry";

export {
  configureBlogSystem,
  buildBlogDraftPayloadThroughSystem,
  materializeBlogImageThroughSystem,
  getBlogProjectStore,
} from "./facade";

export type {
  BlogSystemDeps,
  BlogImageMaterializeInput,
  BlogImageMaterializeResult,
  BlogProjectStore,
  BlogProjectSummary,
} from "./facade";

// ── Default generic connector ─────────────────────────────────────────────

export { defaultBlogConnector } from "./default-connector";

// ── Legacy converter registry (DEPRECATED) ────────────────────────────────

export {
  registerWordPressContentConverter,
  getWordPressContentConverter,
} from "./legacy-converter-registry";
export type {
  WordPressContentConverterInput,
  WordPressContentConverterOutput,
  WordPressContentConverterFn,
} from "./legacy-converter-registry";
