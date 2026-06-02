import "server-only";

// ---------------------------------------------------------------------------
// @cinatra-ai/blog-connector MCP module — exposes `blog_connector_list`.
//
// Read-only primitive listing the registered blog connectors. Powers the
// WordPress connection-UI selector so an operator can pick `default`,
// `ossflywheel`, or any future vendor-scoped connector when configuring/editing
// a WP instance.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { listInstalledBlogConnectors } from "../registry";

// Structural tool-server type — kept STRUCTURAL (not imported from
// `@cinatra-ai/mcp-server`) so the connector depends only on the SDK; the host's
// real `McpRuntimeToolServer` satisfies it. The canonical IoC registration path
// is `register(ctx)` (see ../register.ts); this host-static module remains the
// production-serving path until the host→connector cutover retires it.
type BlogToolServer = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTool(...args: any[]): unknown;
};

const blogConnectorListInputSchema = z.object({});

export function registerBlogPrimitives(server: BlogToolServer): void {
  server.registerTool(
    "blog_connector_list",
    {
      title: "blog_connector_list",
      description:
        "List the blog connectors registered with the @cinatra-ai/blog-connector " +
        "facade. Used by the WordPress connection UI selector to pick a site-specific " +
        "connector (e.g. `default` for generic WP, `ossflywheel` for the ossflywheel " +
        "Elementor layout). Returns `{items: Array<{connectorId, name, slug, description, settingsHref?, supportsElementor?}>}`.",
      inputSchema: blogConnectorListInputSchema,
    },
    async () => {
      const items = listInstalledBlogConnectors().map((c) => ({
        connectorId: c.definition.connectorId,
        name: c.definition.name,
        slug: c.definition.slug,
        description: c.definition.description,
        settingsHref: c.definition.settingsHref,
        supportsElementor: c.definition.supportsElementor,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ items }),
          },
        ],
        structuredContent: { items } as unknown as Record<string, unknown>,
      };
    },
  );
}

export function createBlogModule() {
  return {
    registerCapabilities: registerBlogPrimitives,
  };
}
