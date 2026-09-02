---
icon: 🍴
---

# Syncing the AttuneSolutions Fork

`AttuneSolutions/activepieces` is a fork of `activepieces/activepieces` that carries our own commits on `main`. Keeping it current means merging upstream in, never rebasing our commits onto it.

## Procedure

1. `git remote add upstream https://github.com/activepieces/activepieces.git` — fresh clones of the fork have **only** `origin`; the upstream remote is not inherited and has to be added by hand.
2. `git fetch upstream main --no-tags --negotiation-tip=refs/heads/main` — fetch **one ref**, not the whole remote (see Gotchas).
3. Stash any dirty `.env.dev` before checking out `main` (see Gotchas).
4. `git checkout main && git merge upstream/main` — **merge, not rebase**. Our commits keep their SHAs and any open PR bases stay valid, at the cost of one merge commit. A rebase rewrites every one of our SHAs and forces a force-push, which breaks other clones and open PRs.
5. Resolve conflicts, regenerate `bun.lock` with `bun install` (never hand-merge it), restore the stash.

Feature branches are synced separately and only when they need it — merging upstream into `main` does not touch them.

## Gotchas

- **`git fetch upstream` with no refspec downloads every upstream branch and tag — ~680 MB and many minutes.** Almost none of it is history we need. `git fetch upstream main --no-tags` pulled the same 304 missing commits in **6 MiB and 8 seconds**. If a bare fetch is already grinding, kill it, delete the abandoned `.git/objects/pack/tmp_pack_*` files it leaves behind, and re-run scoped. Never reach for `--depth`: a shallow upstream ref has no merge base with our full history, so the merge degrades into unrelated-histories.
- **`.env.dev` is tracked and diverges per branch.** Feature branches commonly extend `AP_DEV_PIECES` with the pieces they touch, so the file differs between `main` and the branch *and* usually carries an uncommitted local edit on top. Checking out `main` with it dirty conflicts or silently drags the edit across — stash first, restore after.
- **Upstream restructured `brain/` in late 2025: `brain/wiki/*` and `brain/decisions/` became `brain/knowledge/*`, with decisions nested at `brain/knowledge/decisions/`.** Git renames the files we never touched, but every page our fork *edited* surfaces as a `modify/delete` conflict against the dead `brain/wiki/` path. Port each one forward by replaying our own diff onto the new path — `git diff <merge-base> HEAD -- brain/wiki/<f> | sed 's|brain/wiki/|brain/knowledge/|g' | git apply -3` — then `git rm` the stale `brain/wiki/` copy. Our brain edits are almost always appends to a `Gotchas` list, so where both sides appended, keep both sets of bullets rather than choosing.
- **Our fork-safety CI changes are load-bearing and must survive every sync.** `9a048cfb7` added `if: github.repository == 'activepieces/activepieces'` to `dast.yml`, `continuous-delivery-release.yml`, `continuous-delivery-stg.yml` and `sync-betterstack-playwright.yml`, and `efeb10695` deleted `close-external-prs.yml` outright — that job auto-closes external PRs, which is hostile on a fork. Upstream keeps modifying the deleted file, so it returns as a `modify/delete` conflict on every sync: keep it deleted. Grep for the guard string (`github.repository ==`, *not* `repository_owner`) after merging, and check any newly added upstream workflow for one.
