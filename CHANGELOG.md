# Changelog

All notable changes to this project are documented here, derived from the
project's merged pull request and release-tag history.

## v0.1.1 — 2026-06-13

- feat(facade): lazy host-injected capability resolver for blog connectors (#1)
- ci: adopt source-leak-gate (#2)
- ci: adopt source-leak-gate (#3)
- chore: add .gitignore (#4)
- ci: adopt org gate suite v0.1.0 + SHA-pin all remote actions (#5)
- chore: keep internal planning notes untracked (#6)
- Self-configure the blog facade at serverEntry activation; globalize registry + facade deps (#7)
- chore: npm packaging hygiene — files allowlist + git-archive export-ignore (#8)
- Register the blog-system capability from register(ctx) (cinatra#7 P721) (#9)
- ci(release): grant contents: write + pin reusable workflow to .github HEAD (#10)
- chore: Configure Renovate (#11)
- ci: repin reusable release workflow (immutable-safe decoration + corrected build-input provisioning) (#13)
- release: blog-connector v0.1.1 (republish on corrected serverEntry build pipeline) (#14)

## v0.1.0 — 2026-06-03

- Initial release.

## Unreleased

- ci: add truthful-attribution-gate (WARN mode) (#15)
- ci: adopt the reusable extension->host IoC conformance gate (org-wide rollout) (#16)
- ci: tag-driven GitHub release on v* (#17)
- ci: adopt secret-scan-gate (#18)
- docs(readme): expand README to the org standard (#19) (#20)
- ci: adopt source-leak-gate (#21)
- ci: adopt source-leak-gate (#22)
- chore: strip private engineering-tracker refs from public source (#23)
- chore: strip private tracker references from workflow comments (#26)
- ci(release): pin reusable-extension-release to gated v0.1.1 (release-approval wall) (#27)
- chore: add cinatra.vendor and displayName connector metadata (#28)
- fix(security): escape connector-generated blog HTML (no raw passthrough) (#30)
- chore(deps): declare cinatra.consumes for closure-gate enrollment (#29)

