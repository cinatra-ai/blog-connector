import { describe, expect, it } from "vitest";
import {
  configureBlogSystem,
  materializeBlogImageThroughSystem,
} from "../facade";
import type {
  BlogImageMaterializeInput,
  BlogImageMaterializeResult,
  BlogSystemDeps,
} from "../facade";

// Facade shape gate for the `materializeBlogImage` dep. The host injects the
// real impl via `configureBlogSystem`; this test verifies the wiring + the
// throw-on-unconfigured path, with no DB / network / @/lib touches.

describe("materializeBlogImageThroughSystem facade shape", () => {
  it("delegates to deps.materializeBlogImage with the input payload", async () => {
    const calls: BlogImageMaterializeInput[] = [];
    const expected: BlogImageMaterializeResult = {
      artifactId: "artifact-xyz",
      representationRevisionId: "rep-rev-1",
    };
    const deps: BlogSystemDeps = {
      resolveConnectorId: async () => "default",
      materializeBlogImage: async (input) => {
        calls.push(input);
        return expected;
      },
    };
    configureBlogSystem(deps);

    const result = await materializeBlogImageThroughSystem({
      imageBase64: "AAAA",
      imageMimeType: "image/png",
      title: "hero",
    });

    expect(result).toEqual(expected);
    expect(calls).toEqual([
      { imageBase64: "AAAA", imageMimeType: "image/png", title: "hero" },
    ]);
  });

  it("throws a clear error if `materializeBlogImage` is missing", async () => {
    configureBlogSystem({
      resolveConnectorId: async () => "default",
    });
    await expect(
      materializeBlogImageThroughSystem({
        imageBase64: "AAAA",
        imageMimeType: "image/png",
      }),
    ).rejects.toThrow(/materializeBlogImage/);
  });
});
