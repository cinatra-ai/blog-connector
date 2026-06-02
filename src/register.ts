// The blog-connector's `register(ctx)` server entry.
//
// Registers the `blog_connector_list` MCP primitive through `ctx.mcp.registerTool`
// instead of importing host MCP internals. The primitive lists the blog
// connectors registered with the facade — no actor/tenant context needed.
//
// ADDITIVE: the legacy host-static registration (`createBlogModule`) still runs
// and remains the production-serving path until the host→connector cutover
// retires it (the host dedupes by tool name).

import "server-only";
import { z } from "zod";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { listInstalledBlogConnectors } from "./registry";

const blogConnectorListInputSchema = z.object({});

export function register(ctx: ExtensionHostContext): void {
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
