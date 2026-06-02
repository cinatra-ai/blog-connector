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
    return this.entries.get(id) ?? null;
  }

  listAll(): readonly BlogConnector[] {
    return Array.from(this.entries.values());
  }

  size(): number {
    return this.entries.size;
  }

  _clearForTests(): void {
    this.entries.clear();
  }
}

export const blogConnectorRegistry = new BlogConnectorRegistryImpl();

export function registerBlogConnector(connector: BlogConnector): void {
  blogConnectorRegistry.register(connector);
}

export function listInstalledBlogConnectors(): readonly BlogConnector[] {
  return blogConnectorRegistry.listAll();
}
