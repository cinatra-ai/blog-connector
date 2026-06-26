# Blog Publishing

Turn a finished blog post from a Cinatra blog agent into a publish-ready draft for your CMS. The connector hands the structured post — title, body, hero image, metadata — to the right publisher for each destination site, so the same blog flow can ship to WordPress today and a bespoke CMS tomorrow.

Install via the marketplace: find Blog Publishing, click Install, and the connector activates automatically. No additional configuration is required for the default WordPress path. To bind a site-specific connector to a WordPress instance, open the instance settings and set the Blog Connector field to the desired connector ID (for example, `ossflywheel` for an Elementor-based site).

The connector exposes a `blog_connector_list` MCP tool that returns the IDs, names, slugs, and Elementor-support flags for all registered connectors. The host application calls `buildBlogDraftPayloadThroughSystem` with a `BlogDraftBuildInput` value — title, body (Markdown or HTML), excerpt, and featured media — plus an optional `opts` object carrying the explicit connector ID or per-instance connector ID hint, and receives a `BlogDraftPayload` with a `createPayload` ready for the WordPress Drafts API and an optional `postMeta` map for custom fields.

The default connector converts Markdown to HTML (paragraphs, headings h4-h6, bold, italic, inline code, links, lists). For sites needing template injection or Elementor layout, install a vendor-scoped connector such as `@oss-flywheel/blog-connector`, which registers under its own connector ID. Run `blog_connector_list` to verify which connectors are active.

For local development, clone the repository and run `pnpm install && pnpm test` to execute the unit test suite. The connector self-configures at activation by resolving a host routing capability published by the Cinatra platform; if that service is not available when the connector activates, it throws a descriptive error. For troubleshooting a missing connector ID at runtime, the error message lists every registered connector ID so you can confirm the expected package is installed and active.

## Works with

- WordPress
- Site-specific publishers installed as extensions

## Capabilities

- Take a generated blog post and prepare it as a CMS-ready draft
- Route each post to the right publisher for its destination site
- Carry generated hero images through to the published post
- Keep the same blog flow working as you add new publish targets
