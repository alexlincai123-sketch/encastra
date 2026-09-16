# The six open Dependabot pull requests, read one at a time — 2026-09-16

`docs/RELEASE_CANDIDATE_READINESS.md` §5 said "six pull requests on day one, four of them red in
CI (major bumps of `checkout`, `setup-node`, `upload-artifact`, `@types/node`), none merged". Two
of those three clauses were wrong, and the wrong part matters more than the count.

**All six are red, and not one of them is red because of the dependency it bumps.**

## What was actually failing

Every pull request fails the **Secret scanning** job, for a reason that has nothing to do with its
contents. On a pull request `gitleaks-action` does not scan the checkout: it asks the API for the
pull request's commits and scans those. `ci.yml` granted the workflow `contents: read` and nothing
else, so that call came back:

```
RequestError [HttpError]: Resource not accessible by integration
    at async Object.ScanPullRequest (...)
  status: 403
```

The action threw, and the job went red. It would have gone red identically for a branch carrying a
private key, because it never got as far as looking. **Secret scanning has never run on a pull
request in this repository** — the gate that exists to keep credentials out of them has, so far,
only ever run on pushes to `main`.

Fixed in this cycle: the job gets `pull-requests: read`, and `GITLEAKS_ENABLE_COMMENTS=false` so it
never needs write access to say what it found. The finding belongs in the job's exit code, and a
scanner is the last thing that should be able to write anywhere.

The three npm pull requests *also* show **Rust — ubuntu-latest** failing, and that is stale: those
runs are from 2026-09-15T12:25, before rc.2 made the fuzz-corpus seed version-independent. The
three that ran after that fix show only the gitleaks failure. Nothing was re-run, so the red badge
on those three has been reporting a defect that was fixed the same day.

## The pull requests

| # | Bump | Kind | Decision |
|---|---|---|---|
| 1 | `actions/checkout` 5.1.0 → 7.0.1 | workflow | **Hold** — see below |
| 2 | `actions/upload-artifact` 4.6.2 → 7.0.1 | workflow | **Hold** |
| 3 | `actions/setup-node` 5.0.0 → 7.0.0 | workflow | **Hold** |
| 4 | `next` 16.3.4 → 16.3.5, `@types/three` 0.185.4 → 0.186.0 | web | **Take** |
| 5 | `@types/node` 24.13.4 → 26.5.1 | dev types | **Refuse, with a reason** |
| 6 | `vitest` 4.1.11 → 5.0.0 | test runner | **Refuse, already decided** |

### 4 — take it

`next` 16.3.4 → 16.3.5 is a patch release of backported fixes, one of which adds a CSP nonce to the
script tags of loading and template files. This repository serves a marketing site with a strict
content policy; a missing nonce there is the kind of thing that is either a broken page or a
weakened policy, and neither is worth keeping for the sake of not moving.

`@types/three` 0.185.4 → 0.186.0 is a correction, not an upgrade: `three` is already `^0.186.0` in
the same file, so the types described the previous minor. ADR-0010's rule is current stable, and
these are both that.

### 5 — refuse, and say why

`@types/node` 26.5.1 describes the standard library of Node 26. This project builds with Node
**24.15.0**, pinned in `.nvmrc` and named in `docs/RELEASE.md` beside the hashes, because the
frontend bundle is embedded in the shipped executable and the tool that produces it is part of the
recipe. Types one major ahead of the runtime type-check code against APIs that will not be there —
they make the compiler agree with a program that would fail. The correct bump for `@types/node` is
whatever tracks 24.x, and it should move when the pinned Node moves, not before.

### 6 — refuse, already decided

ADR-0010 records this one by name: *"**Vitest 4.1.11**, not 5.0.0 — 5.0.0 was eight days old and
changes mock-clearing defaults. No feature in it is needed."* Nothing has changed except that the
release is now older. The reasoning was about mock-clearing defaults across a suite of 667 tests,
and adopting it during a release-candidate cycle would mean re-reading every one of them to find
which had been relying on the old behaviour. It can be taken deliberately, after the release, as
its own piece of work.

### 1, 2 and 3 — hold, and exactly why

These are major bumps of three actions the workflows pin by SHA. They change nothing but
`.github/`, and the only thing failing on them is the gitleaks defect above.

They are held rather than taken for one reason, stated plainly: **the fix that would let their CI
tell us anything is on `rc/rc4-closure`, not on `main`**, and a pull request's checks run against
the base branch's workflows. Until the gitleaks permission lands on `main`, re-running them
produces the same 403 and proves nothing — so merging them would mean merging three untested
workflow changes into the one place a release is built from. That is the wrong trade for three
actions that work.

The unblocking step is a single one, and it is not a judgement call:

1. Land the `pull-requests: read` change on `main` (it is in this branch).
2. `gh pr comment <n> --body "@dependabot rebase"` on each of 1, 2 and 3.
3. If all checks are green, take them; the SHA pins mean the diff is reviewable in full.

Note while doing it: the gitleaks run already warns that `gitleaks/gitleaks-action@ff98106e` is
pinned to a version targeting Node 20, which GitHub is deprecating. That is a fourth action worth
moving, and Dependabot has not opened a pull request for it because it is pinned to a SHA with a
`# v2` comment rather than a tag it can compare.

## What this says about the process

Six red badges were read as "four major bumps are red, as majors often are" and left alone. They
were in fact one broken gate, reported six times, sitting in front of a security control that had
never executed. A red check whose cause has not been read is not information — and the cost of
reading it here was one log.
