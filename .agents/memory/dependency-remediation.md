---
name: Dependency remediation
description: pnpm update limitations observed while fixing transitive security findings.
---

Targeting transitive package names with `pnpm update -r ... --depth Infinity` can leave their locked versions unchanged. Refresh the owning direct dependencies first; use narrowly scoped overrides when the latest parent still retains an unsafe transitive resolution.

**Why:** A successful update command removed only direct-package findings while leaving most transitive findings intact. Even refreshing parents retained some older resolutions.

**How to apply:** Compare an actual dependency audit and resolved dependency tree after remediation. Preserve the one-day minimum release age and never treat a successful install as proof that security findings are resolved.
