# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript — all source files under `src/`, targeting ES2023 with strict mode

**Secondary:**
- Not applicable

## Runtime

**Environment:**
- Node.js (ESM-only package; `"type": "module"` in `package.json`)
- Targets server-side execution only (`server-only` import guard in `src/facade.ts`, `src/mcp/module.ts`, `src/register.ts`)

**Package Manager:**
- pnpm (inferred from `.npmrc` presence; `auto-install-peers=false`)
- Lockfile: not present in repo root (managed at workspace/monorepo level)

## Frameworks

**Core:**
- None — this is a library/extension package, not an application framework

**Testing:**
- Vitest ^4.1.6 — test runner and assertion library; config at `vitest.config.ts`

**Build/Dev:**
- TypeScript compiler (`tsc`) — targets `dist/`, `outDir` set in `tsconfig.json`
- No bundler detected; module resolution set to `bundler` for consumption by host

## Key Dependencies

**Critical:**
- `zod` ^4.4.3 — runtime schema validation; used in `src/register.ts` for MCP tool input schema
- `server-only` 0.0.1 — import-time guard that prevents this package from loading in browser/client contexts
- `@cinatra-ai/sdk-extensions` (peer, optional) — provides `ExtensionHostContext`, `BlogConnectorDefinition`, and the `blog-contract` sub-path; re-exported through `src/contract.ts` and `src/index.ts`

**Infrastructure:**
- Not applicable — no database clients, HTTP clients, or infrastructure SDKs

## Configuration

**Environment:**
- No `.env` files present in repo root
- No runtime environment variable reads detected in source files

**Build:**
- `tsconfig.json` — standalone strict TypeScript config (not extending a monorepo base); targets ES2023, ESNext modules, `bundler` resolution
- `vitest.config.ts` — configures node test environment; aliases `server-only` to `src/__tests__/server-only-stub.ts` for unit test isolation
- `.npmrc` — `auto-install-peers=false`

## Platform Requirements

**Development:**
- Node.js with ESM support
- pnpm workspace (peer dep `@cinatra-ai/sdk-extensions` resolved via workspace)

**Production:**
- Server-side only (RSC / Next.js server context); `server-only` guard enforces this at import time
- Consumed as a Cinatra extension; `package.json` `cinatra` metadata declares `kind: connector`, `sdkAbiRange: "^2"`, `serverEntry: "./register"`, and `requestedHostPorts: ["mcp"]`

---

*Stack analysis: 2026-06-09*
