import { describe, expect, it } from "vitest";
import { configureBlogSystem, getBlogProjectStore } from "../facade";
import type {
  BlogProjectStore,
  BlogProjectSummary,
  BlogSystemDeps,
} from "../facade";

// Facade shape gate for the `projectStore` dep. The host injects the
// real impl via `configureBlogSystem`; this test verifies the wiring +
// the throw-on-unconfigured path with no DB / network / @/lib touches.

const SAMPLE: BlogProjectSummary = {
  id: "p1",
  name: "Blog 1",
  companyUrl: "https://example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeStubStore(): BlogProjectStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    listProjects: async () => {
      calls.push("listProjects");
      return [SAMPLE];
    },
    getProject: async (id) => {
      calls.push(`getProject:${id}`);
      return SAMPLE;
    },
    updatePostImageArtifactRefs: async (input) => {
      calls.push(`updatePostImageArtifactRefs:${input.projectId}:${input.postId}`);
    },
  };
}

describe("getBlogProjectStore projectStore facade", () => {
  it("returns the host-injected projectStore from BlogSystemDeps", async () => {
    const stub = makeStubStore();
    const deps: BlogSystemDeps = {
      resolveConnectorId: async () => "default",
      projectStore: stub,
    };
    configureBlogSystem(deps);

    const store = getBlogProjectStore();
    await store.listProjects();
    await store.getProject("p1");
    await store.updatePostImageArtifactRefs({
      projectId: "p1",
      postId: "post1",
      imageArtifactId: "art1",
      imageRepresentationRevisionId: "rev1",
    });
    expect(stub.calls).toEqual([
      "listProjects",
      "getProject:p1",
      "updatePostImageArtifactRefs:p1:post1",
    ]);
  });

  it("throws a clear error when projectStore is missing", () => {
    configureBlogSystem({ resolveConnectorId: async () => "default" });
    expect(() => getBlogProjectStore()).toThrow(/projectStore/);
  });
});
