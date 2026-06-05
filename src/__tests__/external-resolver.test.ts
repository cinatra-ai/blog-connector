import { describe, it, expect, beforeEach } from "vitest";
import {
  blogConnectorRegistry,
  registerBlogConnector,
  listInstalledBlogConnectors,
} from "../registry";
import type { BlogConnector } from "../contract";

// The registry merges LOCALLY-registered connectors with a host-injected,
// lazily-PULLED resolver (wired by the host from the capability registry via
// configureBlogSystem). These tests cover that merge: both read paths (get /
// listAll), local-wins-on-collision, and lazy teardown (nothing cached).

function fakeConnector(id: string): BlogConnector {
  return {
    definition: { connectorId: id, name: id, slug: id, description: "", settingsHref: "", supportsElementor: false },
    buildDraftPayload: async () => ({
      createPayload: { title: "", excerpt: "", status: "draft", content: "" },
    }),
  } as unknown as BlogConnector;
}

describe("blogConnectorRegistry — host-injected capability resolver merge", () => {
  beforeEach(() => {
    blogConnectorRegistry._clearForTests();
  });

  it("get() and listAll() include host-injected (capability) connectors", () => {
    const ext = fakeConnector("ossflywheel");
    blogConnectorRegistry.setExternalResolver(() => [ext]);

    expect(blogConnectorRegistry.get("ossflywheel")).toBe(ext);
    expect(listInstalledBlogConnectors().map((c) => c.definition.connectorId)).toContain(
      "ossflywheel",
    );
  });

  it("a LOCALLY registered connector WINS over a capability one with the same id", () => {
    const local = fakeConnector("dup");
    const external = fakeConnector("dup");
    registerBlogConnector(local);
    blogConnectorRegistry.setExternalResolver(() => [external]);

    expect(blogConnectorRegistry.get("dup")).toBe(local);
    const dups = listInstalledBlogConnectors().filter((c) => c.definition.connectorId === "dup");
    expect(dups).toHaveLength(1);
    expect(dups[0]).toBe(local);
  });

  it("is LAZY — a teardown (resolver stops returning it) is reflected immediately; nothing is cached", () => {
    let live: BlogConnector[] = [fakeConnector("transient")];
    blogConnectorRegistry.setExternalResolver(() => live);
    expect(blogConnectorRegistry.get("transient")).not.toBeNull();

    live = []; // simulate invalidateProvidersForPackage on archive/uninstall
    expect(blogConnectorRegistry.get("transient")).toBeNull();
    expect(listInstalledBlogConnectors().map((c) => c.definition.connectorId)).not.toContain(
      "transient",
    );
  });

  it("setExternalResolver(null) reverts to locally-registered connectors only", () => {
    blogConnectorRegistry.setExternalResolver(() => [fakeConnector("x")]);
    blogConnectorRegistry.setExternalResolver(null);
    expect(blogConnectorRegistry.get("x")).toBeNull();
  });
});
