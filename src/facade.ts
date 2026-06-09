import "server-only";

// ---------------------------------------------------------------------------
// @cinatra-ai/blog-connector — provider-agnostic facade.
//
// The facade is the single chokepoint every WordPress publish goes through:
//
//   the host application → buildBlogDraftPayloadThroughSystem(input, opts)
//     → resolveConnectorId(blogConnectorIdHint, ...)
//     → delegate to connector.buildDraftPayload(input)
//     → return {createPayload, postMeta?}
//
// The host then calls `createWordPressDraft(createPayload)` and, if
// `postMeta` is defined, `updateWordPressDraftMeta({meta: postMeta})`. The
// facade itself is DB-agnostic and provider-agnostic.
// ---------------------------------------------------------------------------

import type {
  BlogConnector,
  BlogDraftBuildInput,
  BlogDraftPayload,
} from "./contract";
import { blogConnectorRegistry } from "./registry";

/**
 * Input shape for the host-side `materializeBlogImage` impl. The facade
 * passes through without ever touching `@/lib` directly.
 */
export type BlogImageMaterializeInput = {
  imageBase64: string;
  imageMimeType: string;
  title?: string;
  createdByRunId?: string | null;
};

export type BlogImageMaterializeResult = {
  artifactId: string;
  representationRevisionId: string;
};

/**
 * Operational metadata + artifact-ref operations on a blog project, exposed
 * to the facade so it never has to import host-side blog modules directly.
 * Narrow on purpose: future `blog_project_*` / `blog_post_update` primitives
 * can widen this as more blog capabilities migrate into the facade.
 * No content bytes — refs only; image artifacts are canonical.
 */
export type BlogProjectSummary = {
  id: string;
  name: string;
  companyUrl: string;
  createdAt: string;
  updatedAt: string;
};

export interface BlogProjectStore {
  listProjects(): Promise<BlogProjectSummary[]>;
  getProject(projectId: string): Promise<BlogProjectSummary | null>;
  updatePostImageArtifactRefs(input: {
    projectId: string;
    postId: string;
    imageArtifactId?: string;
    imageRepresentationRevisionId?: string;
    imagePrompt?: string;
  }): Promise<void>;
}

/**
 * Routing chain — implemented in the host via `configureBlogSystem`. Today:
 *   1. explicit `connectorId` (caller passed it)
 *   2. `WordPressInstanceSettings.blogConnectorId` (per-instance default)
 *   3. registered "default" generic connector
 *
 * Host-injected `materializeBlogImage` routes Gemini-produced image bytes
 * through the semantic-artifact pipeline. Optional so the facade still loads
 * in test contexts that don't wire it; runtime callers throw a clear error if
 * it is missing.
 */
export interface BlogSystemDeps {
  resolveConnectorId: (opts: {
    explicitConnectorId?: string;
    /** Per-instance default if the WP-instance row carries `blogConnectorId`. */
    instanceBlogConnectorId?: string;
  }) => Promise<string>;
  materializeBlogImage?: (
    input: BlogImageMaterializeInput,
  ) => Promise<BlogImageMaterializeResult>;
  projectStore?: BlogProjectStore;
  /**
   * Optional host-injected resolver for connectors registered OUT-OF-BAND via the
   * capability registry — a hot-installed vendor connector self-registers through
   * `ctx.capabilities.registerProvider("blog-connector", …)` rather than the
   * host naming its scope. Pulled LAZILY by the registry on every read, so a
   * teardown is reflected immediately and nothing is copied/cached. The host wires
   * it from `resolveCapabilityProviders("blog-connector")` in
   * src/lib/register-blog-providers.ts.
   */
  resolveConnectorProviders?: () => readonly BlogConnector[];
}

let _deps: BlogSystemDeps | null = null;

export function configureBlogSystem(deps: BlogSystemDeps): void {
  _deps = deps;
  // Forward the optional capability-provider resolver to the registry so BOTH
  // read paths merge host-injected connectors lazily: `get(id)` (via getProvider)
  // and `listAll()` (via listInstalledBlogConnectors).
  blogConnectorRegistry.setExternalResolver(deps.resolveConnectorProviders ?? null);
}

function getDeps(): BlogSystemDeps {
  if (!_deps) {
    throw new Error(
      "@cinatra-ai/blog-connector: blog system not configured. " +
        "Call configureBlogSystem(deps) at boot (typically from " +
        "src/lib/register-blog-providers.ts).",
    );
  }
  return _deps;
}

function getProvider(id: string): BlogConnector {
  const connector = blogConnectorRegistry.get(id);
  if (!connector) {
    const known = blogConnectorRegistry
      .listAll()
      .map((c) => c.definition.connectorId)
      .join(", ");
    throw new Error(
      `@cinatra-ai/blog-connector: no blog connector registered for id "${id}". ` +
        `Registered: [${known || "<none>"}]. ` +
        `Add a registerBlogConnector(...) call in src/lib/register-blog-providers.ts.`,
    );
  }
  return connector;
}

/**
 * Build the create-draft payload + optional postMeta for a single blog post.
 *
 * Calling convention: the host application
 * fetches `latestPublishedPost` + uploads `featuredMedia`, then calls this
 * with `{instanceBlogConnectorId: instance.blogConnectorId}` so the routing
 * chain can pick the right connector for the instance.
 */
export async function buildBlogDraftPayloadThroughSystem(
  input: BlogDraftBuildInput,
  opts?: {
    connectorId?: string;
    instanceBlogConnectorId?: string;
  },
): Promise<BlogDraftPayload> {
  const deps = getDeps();
  const connectorId = await deps.resolveConnectorId({
    explicitConnectorId: opts?.connectorId,
    instanceBlogConnectorId: opts?.instanceBlogConnectorId,
  });
  const connector = getProvider(connectorId);
  return connector.buildDraftPayload(input);
}

/**
 * Materialize Gemini-produced blog image bytes into a
 * `@cinatra-ai/blog-image-artifact`. Mirrors
 * `buildBlogDraftPayloadThroughSystem` — facade is the chokepoint;
 * host injects the concrete impl via `configureBlogSystem`.
 */
export async function materializeBlogImageThroughSystem(
  input: BlogImageMaterializeInput,
): Promise<BlogImageMaterializeResult> {
  const deps = getDeps();
  if (!deps.materializeBlogImage) {
    throw new Error(
      "@cinatra-ai/blog-connector: `materializeBlogImage` not configured. " +
        "Add it to the configureBlogSystem(...) call in " +
        "src/lib/register-blog-providers.ts.",
    );
  }
  return deps.materializeBlogImage(input);
}

/**
 * Access the host-injected `BlogProjectStore`. Throws if the facade is
 * configured without a project store — every runtime caller must wire it.
 */
export function getBlogProjectStore(): BlogProjectStore {
  const deps = getDeps();
  if (!deps.projectStore) {
    throw new Error(
      "@cinatra-ai/blog-connector: `projectStore` not configured. " +
        "Add it to the configureBlogSystem(...) call in " +
        "src/lib/register-blog-providers.ts.",
    );
  }
  return deps.projectStore;
}
