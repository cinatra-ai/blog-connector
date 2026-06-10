// The blog-connector's `register(ctx)` server entry.
//
// Transport-registration cutover: this facade CONFIGURES ITSELF at activation — the host no longer
// imports this package to call `configureBlogSystem`:
//   - the two HOST-side impls (blog-image materializer, project store) are
//     resolved from the `@cinatra-ai/host:blog-routing` capability the host
//     publishes at boot;
//   - the routing chain (explicit → instance hint → `default`) lives entirely
//     in-package, and the generic `defaultBlogConnector` is registered here;
//   - site connectors that self-registered behind the `blog-connector`
//     capability surface through the registry's lazy external resolver.
//
// It also registers the `blog_connector_list` MCP primitive through
// `ctx.mcp.registerTool` — the primitive lists the blog connectors registered
// with the facade (no actor/tenant context needed).
//
// SDK imports here are TYPE-ONLY (host-peer value-import gate): the host
// routing impls arrive as DATA through `ctx.capabilities`.

import "server-only";
import { z } from "zod";
import type {
  ExtensionHostContext,
  HostBlogRoutingService,
} from "@cinatra-ai/sdk-extensions";
import { listInstalledBlogConnectors, registerBlogConnector, blogConnectorRegistry } from "./registry";
import {
  configureBlogSystem,
  type BlogImageMaterializeInput,
  type BlogImageMaterializeResult,
  type BlogProjectStore,
} from "./facade";
import { defaultBlogConnector } from "./default-connector";
import type { BlogConnector } from "./contract";

const PACKAGE_NAME = "@cinatra-ai/blog-connector";

// Structural guard: a capability impl is `unknown` by contract — validate the
// BlogConnector shape before the registry trusts it.
function isBlogConnector(impl: unknown): impl is BlogConnector {
  if (typeof impl !== "object" || impl === null) return false;
  const candidate = impl as {
    definition?: { connectorId?: unknown; name?: unknown; slug?: unknown };
    buildDraftPayload?: unknown;
  };
  return (
    typeof candidate.definition?.connectorId === "string" &&
    typeof candidate.definition?.name === "string" &&
    typeof candidate.definition?.slug === "string" &&
    typeof candidate.buildDraftPayload === "function"
  );
}

/**
 * Routing chain (unchanged semantics from the host bootstrap this replaces):
 *   1. explicit `connectorId` if caller passed one
 *   2. `instanceBlogConnectorId` (from `WordPressInstanceSettings.blogConnectorId`)
 *   3. generic `"default"` connector
 */
async function resolveConnectorId(opts: {
  explicitConnectorId?: string;
  instanceBlogConnectorId?: string;
}): Promise<string> {
  if (opts.explicitConnectorId) {
    return opts.explicitConnectorId;
  }
  if (opts.instanceBlogConnectorId) {
    return opts.instanceBlogConnectorId;
  }
  // Fallback — the always-present generic connector.
  if (!blogConnectorRegistry.get("default")) {
    throw new Error(
      `${PACKAGE_NAME}: \`default\` connector is not registered. ` +
        "The facade registers it at serverEntry activation (register(ctx)).",
    );
  }
  return "default";
}

function hostBlogRouting(ctx: ExtensionHostContext): HostBlogRoutingService | null {
  const provider = ctx.capabilities.resolveProviders("@cinatra-ai/host:blog-routing")[0];
  return (provider?.impl as HostBlogRoutingService | undefined) ?? null;
}

const blogConnectorListInputSchema = z.object({});

export function register(ctx: ExtensionHostContext): void {
  // Self-configure the facade. The host routing service is REQUIRED on a
  // cutover host (published by a boot import well before activation).
  const routing = hostBlogRouting(ctx);
  if (!routing) {
    throw new Error(
      `${PACKAGE_NAME}: host service "@cinatra-ai/host:blog-routing" is not registered — ` +
        `the host boot wiring (register-blog-providers) must run before activation.`,
    );
  }
  configureBlogSystem({
    resolveConnectorId,
    materializeBlogImage: routing.materializeBlogImage as (
      input: BlogImageMaterializeInput,
    ) => Promise<BlogImageMaterializeResult>,
    projectStore: routing.projectStore as BlogProjectStore,
    // Lazy capability-provider source: site connectors that registered behind
    // the `blog-connector` capability surface to both registry read paths.
    resolveConnectorProviders: () =>
      ctx.capabilities
        .resolveProviders("blog-connector")
        .map((p) => p.impl)
        .filter(isBlogConnector),
  });
  registerBlogConnector(defaultBlogConnector);

  ctx.mcp.registerTool({
    name: "blog_connector_list",
    description:
      "List the blog connectors registered with the blog-content facade. Used by " +
      "the WordPress connection UI selector to pick a site-specific connector " +
      "(e.g. `default` for generic WP, `ossflywheel` for the Elementor layout).",
    inputSchema: blogConnectorListInputSchema,
    handler: async () =>
      listInstalledBlogConnectors().map((c) => ({
        connectorId: c.definition.connectorId,
        name: c.definition.name,
        slug: c.definition.slug,
        description: c.definition.description,
        settingsHref: c.definition.settingsHref,
        supportsElementor: c.definition.supportsElementor,
      })),
  });
}
