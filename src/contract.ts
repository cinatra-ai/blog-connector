// ---------------------------------------------------------------------------
// @cinatra-ai/blog-connector — site-specific blog-content CONTRACT (types only).
//
// The provider-neutral blog contract now lives in the SDK
// (`@cinatra-ai/sdk-extensions/blog-contract`) so a vendor-scoped site connector
// (`@oss-flywheel/blog-connector`, a future generic-CMS connector) depends only on
// the SDK and never imports this facade package. Re-exported here so host code
// importing the contract from `@cinatra-ai/blog-connector` keeps working.
// ---------------------------------------------------------------------------

export type {
  BlogConnectorDefinition,
  BlogConnectorId,
  BlogDraftBuildInput,
  BlogDraftCreatePayload,
  BlogDraftPayload,
  BlogConnector,
} from "@cinatra-ai/sdk-extensions/blog-contract";
