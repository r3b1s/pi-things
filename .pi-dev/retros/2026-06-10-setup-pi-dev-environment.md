# Handoff: setup-pi-dev-environment

## State

Implemented the isolated pi development environment for the pi-things monorepo. Working tree clean. Commit `0f13751` on main, 3 ahead of origin.

## Done

- `scripts/pi-dev` bootstrap script: detects/scaffolds `.pi-dev/dev-sources.json`, symlinks global infra dirs, merges settings, launches isolated pi instance
- `.pi-dev/` directory: tracked scaffolding (dev-sources.json, retros/) with gitignored sensitive/generated paths (sessions/, settings.json, trust.json, models.json, auth.json, symlinked infra dirs)
- `.gitignore`: `**/.pi/**` fully ignored, `.pi-dev/` selective ignores
- `openspec/specs/dev-sources/spec.md`: shared spec for dev-sources capability
- Full proposal → adversarial review (2 rounds) → design updates → implementation → review → fixes cycle

## Decisions

- **Symlinks over tilde paths**: Global infra (agents, extensions, npm, etc.) symlinked into `.pi-dev/` rather than using `~` paths in settings. Simpler, more portable.
- **auth.json symlinked**: Structured OAuth — no env var equivalent. Gitignored to protect secrets.
- **Cwd-based resolution**: dev-sources.json looked up in cwd, not a global location. Supports per-directory dev environments.
- **`PI_CODING_AGENT_SESSION_DIR`**: Stripped `sessionDir` from merged settings, set via env for session isolation. Avoids cross-project session bleed.
- **Missing global dirs**: Essential (agents, extensions, skills) → create empty. Optional (themes, prompts) → skip with warning.
- **`**/.pi/**` fully gitignored**: Clean separation — `.pi/` is always local, `.pi-dev/` is the tracked alternative.

## Lessons

- Adversarial review rounds caught real issues (auth.json security, session isolation via env var vs config, missing dir handling edge cases)
- The openspec workflow (propose → review → implement → review) works well for features touching config, scripts, and gitignore simultaneously — lots of subtle interactions
- Bash bootstrap scripts need careful handling of: missing dirs, symlink conflicts, env var propagation, and clean mode

## Next

- Push the 3 commits to origin/main
- Test `scripts/pi-dev` end-to-end on a fresh clone (scaffolding path)
- Consider whether `--clean` should offer to reset settings.json too (currently only sessions/ + trust.json)
- Potential follow-up: `scripts/pi-dev` could detect stale symlinks and re-link on launch
