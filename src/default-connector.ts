import "server-only";

// ---------------------------------------------------------------------------
// @cinatra-ai/blog-connector — `defaultBlogConnector` (generic WP path).
//
// Provider-neutral default for any WP instance without a site-specific
// connector binding. Performs ONLY vendor-agnostic work:
//   - markdown → HTML conversion (when `contentIsHtml !== true`)
//   - inline markdown formatting (bold/italic/code/links)
//
// This connector intentionally contains no vendor-specific rendered-template
// selectors or Elementor-meta knowledge. The generic default emits the article
// HTML as the post content directly; a site whose theme needs template
// injection or Elementor must bind a vendor-scoped connector (e.g.
// `@oss-flywheel/blog-connector`) which owns its own layout logic.
// `postMeta` is NEVER produced here.
// ---------------------------------------------------------------------------

import type {
  BlogConnector,
  BlogDraftBuildInput,
  BlogDraftPayload,
} from "./contract";

// Escape the five HTML-significant characters so any markup in the source text
// becomes inert text. `&` MUST be replaced first (otherwise the entities this
// emits would be double-encoded). `"` is escaped because the only attribute the
// converter emits — the link `href="…"` — is double-quoted, so an escaped `"`
// can never break out of it.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The converter owns ALL emitted markup. Untrusted source text is HTML-escaped
// FIRST, then the inline-markdown regexes run over the escaped text — so the
// ONLY tags in the output are the ones this function generates (`<code>`,
// `<strong>`, `<em>`, `<a>`). The markdown delimiters (`` ` ``, `*`, `_`, `[`,
// `]`, `(`, `)`) are not escaped, so they still drive the transforms; the link
// target is restricted to `http(s)://…` by the regex (no `javascript:`), and
// because the source was escaped first, an injected `"` in the URL is already
// `&quot;` and cannot terminate the `href` attribute.
function applyInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function convertMarkdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = applyInlineMarkdown(paragraph.join(" ").trim());
    if (text) parts.push(`<p>${text}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (listItems.length > 0) {
      parts.push(
        `<ul>${listItems.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("")}</ul>`,
      );
      listItems = [];
    }
    if (orderedItems.length > 0) {
      parts.push(
        `<ol>${orderedItems.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("")}</ol>`,
      );
      orderedItems = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const headingMatch = line.match(/^(#{2,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const sourceLevel = Math.min(6, Math.max(2, headingMatch[1].length));
      const level = Math.min(6, sourceLevel + 2);
      parts.push(
        `<h${level}>${applyInlineMarkdown(headingMatch[2].trim())}</h${level}>`,
      );
      continue;
    }
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      orderedItems = [];
      listItems.push(unorderedMatch[1].trim());
      continue;
    }
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      listItems = [];
      orderedItems.push(orderedMatch[1].trim());
      continue;
    }
    // NO raw-HTML passthrough. A markdown line that looks like an HTML element
    // (`<script>…`, `<iframe>…`) is treated as ordinary paragraph text and is
    // HTML-escaped by applyInlineMarkdown — the converter emits only its own
    // generated markup. A site that must emit raw HTML sets `contentIsHtml`,
    // which bypasses this converter entirely.
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return parts.join("\n");
}

type LatestPublishedPostShape = {
  apiResponse?: {
    title?: { raw?: string };
    excerpt?: { raw?: string };
    content?: { rendered?: string; raw?: string };
    meta?: Record<string, unknown>;
  };
  writableTemplate?: {
    title?: string;
    content?: string;
    excerpt?: string;
  };
};

export const defaultBlogConnector: BlogConnector = {
  definition: {
    connectorId: "default",
    name: "Default WordPress (generic)",
    slug: "default",
    description:
      "Generic WordPress draft path — markdown→HTML only. No site-specific template injection or Elementor logic. Used for any WP instance without a vendor-scoped blog connector binding.",
    supportsElementor: false,
  },

  async buildDraftPayload(
    input: BlogDraftBuildInput,
  ): Promise<BlogDraftPayload> {
    const latestPost = input.latestPublishedPost as
      | LatestPublishedPostShape
      | undefined;
    const title =
      input.postTitle.trim() ||
      latestPost?.apiResponse?.title?.raw ||
      latestPost?.writableTemplate?.title ||
      "Blog post";
    const articleHtml = input.contentIsHtml
      ? input.blogPostContent.trim()
      : convertMarkdownToHtml(input.blogPostContent);
    const excerpt =
      input.postExcerpt.trim() ||
      latestPost?.apiResponse?.excerpt?.raw ||
      latestPost?.writableTemplate?.excerpt ||
      "";

    if (!articleHtml) {
      throw new Error(
        "The blog post draft did not contain any content that could be converted to WordPress HTML.",
      );
    }

    // Generic path: the article HTML IS the post content. No template
    // injection, no Elementor — a site that needs either MUST bind a
    // vendor-scoped connector (e.g. `@oss-flywheel/blog-connector`).
    const createPayload = {
      ...(latestPost?.writableTemplate ?? {}),
      title,
      content: articleHtml,
      excerpt,
      status: "draft" as const,
      ...(input.featuredMedia
        ? { featured_media: input.featuredMedia.id }
        : {}),
    };

    return { createPayload, postMeta: undefined };
  },
};
