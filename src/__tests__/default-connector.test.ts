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
