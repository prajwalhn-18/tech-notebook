---
sidebar_position: 1
---

## Git Workflows

Git is not just version control — it's how your team **communicates changes**, manages releases, and stays unblocked. A bad Git workflow creates merge nightmares. A good one is invisible.

* * *

Branching Strategies
====================

### Trunk-Based Development (TBD)

Everyone commits to `main` (trunk) frequently — at least once a day. Long-lived feature branches are avoided.

```
main ──●──●──●──●──●──●──▶
        ↑  ↑  ↑  ↑  ↑
       devs commit small, frequent changes
```

**Rules:**
- Branches live for hours or 1–2 days max
- Features not ready for production are hidden behind **feature flags**
- CI must pass before merge — every commit is potentially releasable

**When to use:** High-performing teams, continuous delivery, microservices.

* * *

### GitFlow

Two permanent branches: `main` (production) and `develop` (integration). Features branch off `develop`.

```
main     ──────────────────────────●─────────────────▶
                                   ↑ (release)
develop  ──●──────────────────────●──────────────────▶
            ↓             ↑
feature/x  ──●──●──●──●──●
```

**Branches:**
- `feature/*` — new features (branch from `develop`)
- `release/*` — release prep (branch from `develop`, merge to `main` + `develop`)
- `hotfix/*` — production fixes (branch from `main`, merge to `main` + `develop`)

**When to use:** Versioned products, mobile apps, libraries with explicit release cycles.

**Downside:** Complex, many long-lived branches, frequent merge conflicts.

* * *

### GitHub Flow (simplified)

`main` is always deployable. Branch → PR → review → merge → deploy.

```
main        ──●──────────────────────●──▶
               ↓                    ↑
feature/foo   ──●──●──●──●──(PR)──●
```

**Rules:**
- Anything in `main` is deployed immediately
- Descriptive branch names: `feature/user-auth`, `fix/order-total-bug`
- PR = the review gate

**When to use:** Web apps with continuous deployment. The most common workflow today.

* * *

Conventional Commits
====================

A standardized commit message format that enables automated changelogs, semantic versioning, and clear history.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that's not a feature or fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `chore` | Build, deps, config changes |
| `ci` | CI/CD changes |
| `revert` | Reverting a previous commit |

### Examples

```bash
feat(auth): add JWT refresh token rotation

fix(orders): correct tax calculation for international orders

refactor(payments): extract stripe client into separate module

feat(api)!: remove deprecated v1 endpoints

BREAKING CHANGE: /api/v1/* routes have been removed. Use /api/v2/*.
```

The `!` after the type signals a breaking change — triggers a major version bump in semantic versioning.

* * *

Branch Naming
=============

```bash
feature/JIRA-123-user-authentication
fix/JIRA-456-order-total-bug
hotfix/payment-gateway-timeout
release/v2.4.0
chore/upgrade-node-18
```

**Pattern:** `type/ticket-short-description`

Keeps branches traceable back to tickets and immediately communicates intent.

* * *

Rebase vs Merge
================

### Merge (preserves history)

```bash
git checkout main
git merge feature/my-feature
```

```
A──B──C──────────M  (main)
      ↘         ↗
       D──E──F     (feature)
```

Creates a merge commit `M`. History shows exactly when and how branches converged.

**Use when:** You want to preserve the exact history of what happened.

* * *

### Rebase (linear history)

```bash
git checkout feature/my-feature
git rebase main
git checkout main
git merge feature/my-feature  # fast-forward
```

```
A──B──C──D'──E'──F'  (main, linear)
```

Replays your commits on top of the latest `main`. History is clean and linear.

**Use when:** You want readable, bisectable history. Standard for most teams.

**Golden Rule:** Never rebase commits that have been pushed to a shared branch.

* * *

Interactive Rebase
==================

Clean up messy commits before merging a PR.

```bash
git rebase -i HEAD~4
```

```
pick a1b2c3 WIP: started auth
pick d4e5f6 fix typo
pick g7h8i9 more auth work
pick j1k2l3 finished auth

# Change to:
reword a1b2c3 feat(auth): add JWT authentication
fixup  d4e5f6
squash g7h8i9
fixup  j1k2l3
```

- `squash` — combine into previous commit, edit message
- `fixup` — combine into previous commit, discard message
- `reword` — keep commit, edit message
- `drop` — delete the commit

Result: 4 messy commits become 1 clean commit before merge.

* * *

Pull Request Best Practices
============================

### As the author

- **Keep PRs small** — under 400 lines changed. Large PRs get rubber-stamped.
- **Write a clear description** — what changed, why, how to test
- **Self-review first** — read your own diff before requesting review
- **Link the ticket** — `Closes #123` or `Fixes JIRA-456`
- **Don't leave TODOs** — if it's not done, it's not ready

### PR description template

```markdown
## What
Brief description of what this PR does.

## Why
The problem being solved or the reason for the change.

## How
High-level approach taken.

## Testing
How to test this change manually.

## Checklist
- [ ] Tests added/updated
- [ ] No breaking changes (or documented if so)
- [ ] Docs updated if needed
```

### As the reviewer

- Review the **intent**, not just the code
- Distinguish between: **blocking** (must fix), **suggestion** (nice to have), **question** (I want to understand)
- Use prefixes: `[blocking]`, `[nit]`, `[question]`
- Approve when **good enough**, not perfect

```
[blocking] This will cause a memory leak if the connection isn't closed.

[nit] Variable name could be more descriptive — maybe `userSessionToken`?

[question] Why are we using a Map here instead of a plain object?
```

* * *

Git Hooks with Husky
====================

Automate checks before commits and pushes hit CI.

```bash
npm install --save-dev husky lint-staged
npx husky init
```

### Pre-commit hook — lint + format

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{js,ts}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### Commit-msg hook — enforce conventional commits

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

```js
// commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

Now `git commit -m "stuff"` fails — you must use conventional commits.

* * *

Useful Git Commands
====================

```bash
# See what changed in the last 5 commits
git log --oneline -5

# Find which commit introduced a bug (binary search)
git bisect start
git bisect bad           # current commit is broken
git bisect good v1.2.0   # last known good state
# Git checks out the midpoint — you test and mark good/bad
git bisect good / git bisect bad
# Git narrows down to the culprit commit

# Temporarily save uncommitted work
git stash
git stash pop

# Undo last commit but keep changes staged
git reset --soft HEAD~1

# See who last changed each line
git blame src/services/orderService.js

# Cherry-pick a specific commit from another branch
git cherry-pick a1b2c3

# Create a tag for a release
git tag -a v2.4.0 -m "Release 2.4.0"
git push origin v2.4.0
```

* * *

.gitignore Essentials
======================

```gitignore
# Dependencies
node_modules/

# Environment variables — NEVER commit these
.env
.env.local
.env.production

# Build output
dist/
build/
.next/

# Logs
*.log
logs/

# Editor
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Coverage
coverage/
```

* * *

When to use what
================

| Scenario | Approach |
|---|---|
| Small fix ready now | Commit directly to `main` (TBD) |
| Feature taking 2+ days | Short-lived branch + PR |
| Prod is broken right now | `hotfix/*` branch off `main` |
| Messy commits before PR | `git rebase -i` |
| Pulling latest without merge commit | `git pull --rebase` |
| Shipped a breaking bug | `git revert` (don't `reset --hard` on shared branches) |

* * *

Interview definition (short answer)
=====================================

> "Trunk-based development with conventional commits and short-lived feature branches is the most effective Git workflow for high-velocity teams. PRs should be small, reviewed quickly, and every commit on main should be releasable."
