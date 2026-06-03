import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    alias: {
      // Stub `server-only` (which throws at import time outside an RSC
      // graph) so unit tests for the default connector can exercise its
      // `buildDraftPayload` without standing up a Next.js server context.
      "server-only": new URL("./src/__tests__/server-only-stub.ts", import.meta.url).pathname,
    },
  },
});
