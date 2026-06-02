// ---------------------------------------------------------------------------
// @cinatra-ai/blog-connector — WordPress content-converter registry.
//
// The modern path is the `BlogConnector` contract
// (`buildDraftPayload -> {createPayload, postMeta?}`) plus the facade routing
// chain. This per-instance converter registry is a dormant compatibility
// surface; the `blog_wordpress_content_convert` asset-blog MCP primitive still
// queries `getWordPressContentConverter` and must keep its stable return shape
// until that surface is retired.
//
// DEPRECATED: new site-specific logic MUST be a `BlogConnector`
// implementation (see `./contract.ts`), NOT a converter registered here.
// ---------------------------------------------------------------------------

export type WordPressContentConverterInput = {
  wordpressInstanceId: string;
  title: string;
  excerpt: string;
  /** The blog post body in markdown format. */
  content: string;
};

export type WordPressContentConverterOutput = {
  title?: string;
  excerpt?: string;
  /**
   * The converted content. Set `contentIsHtml` to `true` when this value is
   * already rendered HTML so the default markdown-to-HTML step is skipped.
   */
  content: string;
  contentIsHtml?: boolean;
};

export type WordPressContentConverterFn = (
  input: WordPressContentConverterInput,
) => Promise<WordPressContentConverterOutput>;

const converterRegistry = new Map<string, WordPressContentConverterFn>();

/**
 * @deprecated Implement a `BlogConnector` (see `./contract.ts`) and register
 * it via `registerBlogConnector` instead. Retained only for the dormant
 * `blog_wordpress_content_convert` asset-blog MCP primitive.
 */
export function registerWordPressContentConverter(
  wordpressInstanceId: string,
  fn: WordPressContentConverterFn,
) {
  converterRegistry.set(wordpressInstanceId, fn);
}

/** Returns the registered converter for the given instance, or `undefined`. */
export function getWordPressContentConverter(
  wordpressInstanceId: string,
): WordPressContentConverterFn | undefined {
  return converterRegistry.get(wordpressInstanceId);
}
