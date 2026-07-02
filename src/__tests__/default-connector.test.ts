import { describe, it, expect } from "vitest";
import { defaultBlogConnector } from "../default-connector";

// The default connector is strictly generic: markdown->HTML, no template
// injection, no Elementor, no ossflywheel selectors. Any site needing layout
// injection must bind a vendor-scoped connector.

describe("defaultBlogConnector.buildDraftPayload (generic, no injection)", () => {
  it("converts markdown to HTML and returns no postMeta", async () => {
    const result = await defaultBlogConnector.buildDraftPayload({
      postTitle: "Hello",
      postExcerpt: "world",
      blogPostContent: "## A heading\n\nA paragraph with **bold** text.",
    });

    expect(result.createPayload.title).toBe("Hello");
    expect(result.createPayload.excerpt).toBe("world");
    expect(result.createPayload.status).toBe("draft");
    expect(result.createPayload.content).toContain("<strong>bold</strong>");
    expect(result.createPayload.content).toContain("<h4>A heading</h4>");
    expect(result.postMeta).toBeUndefined();
  });

  it("emits the article HTML directly as content (NO template injection) even when latestPublishedPost is present", async () => {
    const result = await defaultBlogConnector.buildDraftPayload({
      postTitle: "New Title",
      postExcerpt: "",
      blogPostContent: "Hello world.",
      latestPublishedPost: {
        apiResponse: {
          content: { rendered: "<article>whatever the template was</article>" },
          title: { raw: "Old" },
          excerpt: { raw: "" },
        },
        writableTemplate: {},
      },
    });

    // The generic default does NOT inject into the rendered template — it
    // ignores it entirely and emits the article HTML as content.
    expect(result.createPayload.content).toContain("Hello world");
    expect(result.createPayload.content).not.toContain("whatever the template was");
    expect(result.postMeta).toBeUndefined();
  });

  it("passes featured_media through when provided", async () => {
    const result = await defaultBlogConnector.buildDraftPayload({
      postTitle: "T",
      postExcerpt: "",
      blogPostContent: "Body.",
      featuredMedia: { id: 42, url: "https://cdn.example/img.png" },
    });
    expect(result.createPayload.featured_media).toBe(42);
  });

  it("emits only the generic article HTML regardless of the rendered template", async () => {
    // The generic connector must NOT inject into any vendor template. We assert
    // positively that the output is exactly the converted article HTML. A
    // regression that re-introduced injection would make content !== the
    // article HTML.
    const renderedTemplate =
      "<article><header>VENDOR TEMPLATE CHROME</header><main>OLD BODY</main></article>";
    const result = await defaultBlogConnector.buildDraftPayload({
      postTitle: "T",
      postExcerpt: "",
      blogPostContent: "Just the body.",
      latestPublishedPost: {
        apiResponse: { content: { rendered: renderedTemplate } },
      },
    });
    // Output is the converted article HTML ONLY — no template chrome.
    expect(result.createPayload.content).toContain("Just the body");
    expect(result.createPayload.content).not.toContain("VENDOR TEMPLATE CHROME");
    expect(result.createPayload.content).not.toContain("OLD BODY");
    expect(result.postMeta).toBeUndefined();
  });
});

// The generic markdown->HTML converter must emit ONLY its own generated markup.
// LLM-drafted markdown is untrusted: any HTML tag / attribute in the source must
// be neutralized (escaped as text) so a `unfiltered_html`-capable WordPress
// account cannot receive a stored-XSS payload verbatim.
describe("defaultBlogConnector.buildDraftPayload (output escaping / XSS)", () => {
  async function render(markdown: string): Promise<string> {
    const result = await defaultBlogConnector.buildDraftPayload({
      postTitle: "T",
      postExcerpt: "",
      blogPostContent: markdown,
    });
    return result.createPayload.content ?? "";
  }

  it("neutralizes a <script> line (no raw passthrough)", async () => {
    const html = await render("<script>alert(document.cookie)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralizes an <img onerror> payload inside a paragraph", async () => {
    const html = await render("Look here <img src=x onerror=alert(1)> ok");
    // The whole tag is inert text — never a live <img> element. `onerror=`
    // survives only inside the escaped `&lt;…&gt;` run, so it is not an attribute.
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("neutralizes an <iframe> line", async () => {
    const html = await render('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toContain("<iframe");
    expect(html).toContain("&lt;iframe");
  });

  it("cannot break out of the generated href attribute", async () => {
    // A crafted link whose URL contains a double-quote must not inject a new
    // (event-handler) attribute: the `"` is escaped BEFORE the href is built,
    // so it stays INSIDE the double-quoted href value.
    const html = await render(
      '[click](https://evil.example"onmouseover="alert(1))',
    );
    // No raw double-quote breakout — the injected quotes became entities.
    expect(html).not.toContain('evil.example"');
    expect(html).toContain("evil.example&quot;");
    // No live `on*="` event-handler attribute leaked out of the value.
    expect(html).not.toMatch(/\son[a-z]+="/i);
  });

  it("escapes a bare ampersand and angle brackets in prose", async () => {
    const html = await render("Tom & Jerry say a < b and c > d");
    expect(html).toContain("Tom &amp; Jerry");
    expect(html).toContain("a &lt; b");
    expect(html).toContain("c &gt; d");
  });

  it("still renders legitimate markdown (bold, heading, code, https link)", async () => {
    const html = await render(
      "## Title\n\nA **bold** and `code` line with a [link](https://ok.example).",
    );
    expect(html).toContain("<h4>Title</h4>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://ok.example">link</a>');
  });
});
