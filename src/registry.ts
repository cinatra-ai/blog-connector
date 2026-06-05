import "server-only";

// ---------------------------------------------------------------------------
// @cinatra-ai/blog-connector — provider registry.
//
// Every BlogConnector implementation registers itself here at boot via
// `registerBlogConnector(c)`. The facade (`./facade.ts`) reads from this
// registry to route `buildBlogDraftPayloadThroughSystem` to the right
// vendor-scoped connector.
//
// In-memory singleton. Re-registration is idempotent (replace-by-id;
// mirrors emailConnectorRegistry + socialMediaConnectorRegistry).
// ---------------------------------------------------------------------------

import type { BlogConnector } from "./contract";

class BlogConnectorRegistryImpl {
  private entries: Map<string, BlogConnector> = new Map();

  // Host-injected, lazily-PULLED resolver for connectors registered out-of-band —
  // e.g. a hot-installed vendor connector whose serverEntry self-registers via
  // `ctx.capabilities.registerProvider("blog-connector", …)`. NEVER copied into
  // `entries`: it is resolved on every read so a teardown (the host capability
  // registry's `invalidateProvidersForPackage`) is reflected immediately and no
  // stale connector lingers. Wired by the host through
  // `configureBlogSystem({ resolveConnectorProviders })`.
  private externalResolver: (() => readonly BlogConnector[]) | null = null;

  setExternalResolver(resolver: (() => readonly BlogConnector[]) | null): void {
    this.externalResolver = resolver;
  }

  register(connector: BlogConnector): void {
    const id = connector.definition.connectorId;
    if (this.entries.has(id) && this.entries.get(id) !== connector) {
      console.warn(
        `[blogConnectorRegistry] Replacing existing blog connector "${id}"`,
      );
    }
    this.entries.set(id, connector);
  }

  get(id: string): BlogConnector | null {
    const local = this.entries.get(id);
    if (local) return local;
    // Fall back to host-injected (e.g. hot-installed) providers; a locally
    // registered connector wins on id collision.
    const external = this.externalResolver?.() ?? [];
    return external.find((c) => c.definition.connectorId === id) ?? null;
  }

  listAll(): readonly BlogConnector[] {
    // Merge host-injected + locally-registered providers, deduped by connectorId
    // with the local entry winning (it was registered explicitly).
    const merged = new Map<string, BlogConnector>();
    // External providers: FIRST occurrence wins on a dup connectorId — consistent
    // with get()'s `.find()` (first match), so both read paths agree.
    for (const c of this.externalResolver?.() ?? []) {
      if (!merged.has(c.definition.connectorId)) merged.set(c.definition.connectorId, c);
    }
    // Local entries always override (a locally-registered connector wins).
    for (const [id, c] of this.entries) {
      merged.set(id, c);
    }
    return Array.from(merged.values());
  }

  size(): number {
    return this.entries.size;
  }

  _clearForTests(): void {
    this.entries.clear();
    this.externalResolver = null;
  }
}

export const blogConnectorRegistry = new BlogConnectorRegistryImpl();

export function registerBlogConnector(connector: BlogConnector): void {
  blogConnectorRegistry.register(connector);
}

export function listInstalledBlogConnectors(): readonly BlogConnector[] {
  return blogConnectorRegistry.listAll();
}
