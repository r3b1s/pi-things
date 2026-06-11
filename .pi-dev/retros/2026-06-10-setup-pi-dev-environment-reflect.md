# Reflections: setup-pi-dev-environment

## Lessons

### PI_CODING_AGENT_DIR is the right primitive for config isolation
**Category:** insight
**What happened:** The entire dev environment was built around `PI_CODING_AGENT_DIR` replacing `~/.pi/agent/` for a session, combined with `PI_CODING_AGENT_SESSION_DIR` for session isolation. Pi auto-discovers all resources (extensions, skills, prompts, agents) from the agent directory — no need to enumerate paths in settings.
**Why it matters:** This is the canonical way to create isolated pi environments. The env var approach is simpler and more robust than any alternative (copying config, modifying global settings, per-directory `.pi/` overrides). It's the primitive that makes project-level dev environments possible without polluting the global config.
**What to do about it:** When building tooling that needs pi to behave differently (dev mode, testing, CI), set `PI_CODING_AGENT_DIR` to a generated directory. Merge the global `settings.json`, symlink shared infrastructure, and let pi's auto-discovery handle the rest.

### Symlinks beat tilde-expanded paths in settings
**Category:** insight
**What happened:** The initial design considered writing `~/.pi/agent/extensions/` paths into the merged `settings.json`. The adversarial review surfaced that symlinks are cleaner — pi auto-discovers from the agent dir structure, so settings.json doesn't need infrastructure paths at all.
**Why it matters:** Symlinks keep the dev environment in sync with global config automatically. If you add a new extension globally, it's immediately available in dev mode without editing any config file. Settings.json stays focused on what's *different* (the dev packages), not what's *shared* (the infrastructure).
**What to do about it:** When building a pi dev environment, symlink shared infrastructure directories into the agent dir and let pi discover them. Only put delta configuration (new packages, overrides) in settings.json.

### auth.json contains structured OAuth — no env var substitute
**Category:** insight
**What happened:** During design review, the initial plan was to keep auth.json out of the dev environment entirely (let pi prompt or use env vars). Implementation review revealed that pi's auth.json contains structured OAuth token data, not simple API keys. Symlinking and gitignore was the pragmatic solution.
**Why it matters:** Pi's authentication is not a single `PI_API_KEY` env var. It's a structured file with OAuth refresh tokens, provider configs, and multi-service auth. Any dev environment that needs auth must either symlink the file (gitignored) or require re-authentication on each session.
**What to do about it:** Symlink `auth.json` into the dev agent dir and gitignore it. Document that `scripts/pi-dev --clean` doesn't wipe auth (intentionally). For CI environments where auth can't be symlinked, pi will prompt or fall back to env vars.

### sessionDir in settings.json conflicts with PI_CODING_AGENT_SESSION_DIR
**Category:** insight
**What happened:** The merged settings.json would inherit `sessionDir` from global config. But the script also sets `PI_CODING_AGENT_SESSION_DIR` via env var. If both are present, the env var should win — but implementation review found that having `sessionDir` in the merged config was confusing and could cause unexpected behavior. The fix was to explicitly `pop('sessionDir')` from the merged settings.
**Why it matters:** When merging global config into a dev workspace, keys that conflict with environment variables must be stripped. The env var is the authoritative source for session isolation; leaving the key in config creates ambiguity.
**What to do about it:** When merging global `settings.json` into a dev config, always strip `sessionDir` (and any other keys that will be set via env vars). Document which keys are env-var-controlled.

### Adversarial review catches real issues, but reviewers specialize
**Category:** insight
**What happened:** Two adversarial review rounds (different models) were conducted. Both independently identified the session isolation bug (sessionDir leaking). Each also found unique issues: one caught auth.json security, the other caught the gitignore directory re-include gotcha. The subsequent implementation review caught yet another class of issues the design review missed.
**Why it matters:** Multiple reviewers with different models provide complementary coverage. They converge on critical bugs (validating severity) while diverging on edge cases (expanding surface area). Design review and implementation review are different activities — code review catches bugs that spec review can't.
**What to do about it:** Run at least 2 adversarial review rounds with different models for features touching security, config, or gitignore. Then run a separate implementation review after code is written. Don't skip any of these — they catch different failure modes.

### Implementation review finds issues design review misses
**Category:** insight
**What happened:** Code review after implementation found: `sessionDir` leaking from merged settings, `ensure_symlink` creating directories for file targets, missing `python3` guard, shell injection surface in Python heredoc. None of these were caught during the 2 rounds of design review.
**Why it matters:** Design review evaluates the approach and spec. Implementation review evaluates the actual code. Bugs in bash scripts (heredoc quoting, conditional logic, error handling) and Python snippets embedded in shell scripts require reading the actual code, not the design document.
**What to do about it:** Always follow design review with implementation review. For bash scripts specifically, look for: missing guards (python3, HOME), heredoc quoting issues, symlink vs directory target confusion, and error handling gaps.

### Gitignore directory re-include requires re-including the directory itself
**Category:** tool-quirk
**What happened:** The pattern `!**/.pi/prompts/**` does NOT work to re-include files under `.pi/prompts/` when `**/.pi/**` excludes the parent. Git won't descend into an excluded directory. You must first re-include the directory with `!**/.pi/prompts/`, then its contents can be re-included.
**Why it matters:** This is a common gitignore misconception. Many developers assume you can re-include contents of an excluded directory with a single pattern. You cannot. The directory itself must be re-included first. In this project, we decided not to re-include anything under `.pi/` (full exclude), but this knowledge is critical for projects that use a default-deny with allow-lists.
**What to do about it:** When using `**/.pi/**` as a default-deny, if you need to re-include specific subdirectories, add two patterns: `!**/.pi/prompts/` (re-include the directory) and `!**/.pi/prompts/**` (re-include its contents). The directory re-include must come first.

### **/.pi/** unanchored pattern matches any depth in monorepos
**Category:** tool-quirk
**What happened:** The gitignore pattern `**/.pi/**` matches `.pi/` directories at ANY depth in the repository tree. This is critical for monorepos where packages might have their own `.pi/` directories. Without the `**/` prefix, `.pi/` would only match at the root.
**Why it matters:** In a monorepo, you want all `.pi/` directories (root, `packages/foo/.pi/`, `packages/bar/.pi/`) to be gitignored. The `**/` prefix makes the pattern unanchored. If you used `.pi/**` (no `**/` prefix), it would only match `.pi/` at the repository root — nested package `.pi/` directories would be tracked.
**What to do about it:** For monorepos, always use `**/.pi/**` (not `.pi/**`) to ensure nested `.pi/` directories are also ignored. The `**/` prefix is required because patterns containing a `/` (other than trailing) are anchored by default.

### ensure_symlink must distinguish file vs directory targets
**Category:** tool-quirk
**What happened:** The `ensure_symlink` helper in `scripts/pi-dev` had a bug where it would `mkdir -p` for file targets (like `models.json`) when the global target didn't exist. The implementation review caught this — the function checked `[[ "$name" == *.* ]]` to distinguish files from directories, but the logic was initially inverted.
**Why it matters:** When creating symlinks for both files and directories, the fallback behavior differs: directories should be created empty, files should be touched empty. Getting this wrong means `ln -s` fails with confusing errors or creates the wrong type of entry.
**What to do about it:** In any symlink helper, check the target type (file vs directory) before creating fallbacks. Use file extension heuristics for files (`models.json`, `trust.json`) and no-extension for directories (`agents/`, `extensions/`). Alternatively, check the target with `[[ -d "$target" ]]` vs `[[ -f "$target" ]]` when the target exists.

### Scaffolding UX: prompt for missing config, fail in non-interactive
**Category:** convention
**What happened:** When `.pi-dev/dev-sources.json` doesn't exist, the script checks `[[ -t 0 ]]` (TTY detection). In interactive mode, it prompts to scaffold. In non-interactive mode (CI, piped input), it fails with instructions. The prompt explains *why* the file is needed, not just that it's missing.
**Why it matters:** This is the right UX for developer tools. Interactive scaffolding removes friction for first-time users. Non-interactive failure prevents silent misconfiguration in CI. Explaining the "why" helps developers understand the system rather than just following instructions.
**What to do about it:** Adopt this pattern for all bootstrap scripts: detect TTY, offer to scaffold with explanation, fail gracefully in non-interactive mode. Never silently create defaults that might confuse the user about what state they're in.

### Opt-in dev environment over modifying global config
**Category:** preference
**What happened:** The entire design philosophy was "opt-in isolation" — the dev environment activates only when `scripts/pi-dev` is invoked, and it doesn't modify `~/.pi/agent/` at all. The global config stays pristine regardless of what happens in development.
**Why it matters:** This is a user preference that emerged clearly: the user wants a clean separation between "production" pi usage (global config) and "development" pi usage (project-local). The dev environment should be ephemeral and disposable — `--clean` removes generated state, and the global config is never touched.
**What to do about it:** When building pi tooling, always design for isolation first. The user's stable config should be immutable from the perspective of any project-specific tooling. If a tool needs to modify pi config, it should do so in an isolated copy, not in place.

### Openspec workflow: propose → review → implement → review → archive
**Category:** convention
**What happened:** The openspec workflow was followed faithfully: propose (with design + specs + tasks) → 2 rounds of adversarial review → design updates → implementation → implementation review → fixes → archive → commit. Each stage caught issues the previous stage missed.
**Why it matters:** This workflow is the project's standard for features touching config, scripts, and gitignore simultaneously — areas with lots of subtle interactions. Skipping stages (especially the implementation review) would have let real bugs ship.
**What to do about it:** Maintain the full openspec cycle for non-trivial changes. The investment in design + review pays for itself in avoided rework. For trivial changes (typo fixes, config tweaks), the cycle can be shortened, but the boundary should be explicit.

## Skill Proposals

### `pi-dev-environment-bootstrap`
**Pattern observed:** Setting up an isolated pi development environment follows a consistent pattern: generate agent dir, merge settings, symlink infrastructure, set env vars. This pattern applies to any pi project, not just pi-things.
**What the skill would do:** Provide the template and checklist for creating a `scripts/pi-dev` (or equivalent) for any pi project:
1. Generate isolated agent directory
2. Merge global `settings.json` with project-specific dev sources
3. Symlink shared infrastructure (agents, extensions, models, trust, auth)
4. Strip conflicting keys (sessionDir) from merged settings
5. Set `PI_CODING_AGENT_DIR` and `PI_CODING_AGENT_SESSION_DIR`
6. Launch pi with the isolated environment
**Trigger conditions:** User wants to create a dev environment for pi, or mentions "isolated pi config", "pi development mode", or "project-local pi".
**Scope:** Global (reusable across all pi projects).
**Dependencies:** None beyond pi itself.

### `adversarial-review-protocol`
**Pattern observed:** Running 2 adversarial review rounds with different models before implementation consistently catches critical issues that single-reviewer approaches miss. The protocol is: (1) design review, (2) implementation review, (3) targeted fixes.
**What the skill would do:** Define the review protocol:
1. First round: design/approach review (catch architectural issues)
2. Second round: adversarial review (different model, catch edge cases)
3. Implementation: code the approved design
4. Fourth round: implementation review (catch code-level bugs, especially in bash/python)
**Trigger conditions:** Any openspec change that involves scripts, config files, or security-sensitive changes. Always for changes touching gitignore, auth, or environment variables.
**Scope:** Global (applicable across all projects).
**Dependencies:** None.

### `gitignore-monorepo-patterns`
**Pattern observed:** Gitignore behavior in monorepos has several non-obvious gotchas: unanchored patterns, directory re-include requirements, the difference between `.pi/**` and `**/.pi/**`. These come up repeatedly in monorepo setups.
**What the skill would do:** Provide a reference for gitignore patterns that work correctly in monorepos:
- Default-deny with `**/` prefix for directories at any depth
- Directory re-include requires two patterns (directory + contents)
- Testing gitignore patterns with `git check-ignore -v`
- Common mistakes and their fixes
**Trigger conditions:** User is configuring gitignore in a monorepo, or mentions "gitignore" + "monorepo" or "nested packages".
**Scope:** Global.
**Dependencies:** None.
