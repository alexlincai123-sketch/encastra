# The signing pipeline, and the three modes a build can be in

`docs/SIGNING.md` says what a certificate is, what it costs, what SmartScreen does with it and
what is configured today. This page is the mechanics: what runs, in what order, what each step
refuses, and what a person has to provide. Nothing on it fabricates a signature — every step
that needs a credential fails cleanly without one, and that failure is tested.

```
source (clean commit)
   │
   ▼
build ──────────── build.rs stamps the commit; /Brepro; NSIS SetDateSave off
   │
   ▼
sign ───────────── only if a certificate is present; Tauri calls signtool with a thumbprint
   │                given as a --config overlay (the tree is never edited)
   ▼
verify signature ─ Get-AuthenticodeSignature: Status must be Valid
   │
   ▼
verify certificate  the chain is what makes Status Valid; the subject is recorded
   │
   ▼
verify timestamp ─ a countersignature from tauri.conf.json's timestampUrl must be present,
   │                or the signature dies with the certificate
   ▼
manifest ───────── release_manifest.py: build commit read from the binary, hashes, signature
   │                state; refuses a stale or foreign artefact; refuses unsigned production
   ▼
release check ──── release_check.py: everything above plus tests, dependencies, reproducibility,
   │                CI evidence, the clean-machine log → release-readiness.json
   ▼
release ────────── the publication commit and the tag, by a person, after the verdict
```

## Modes

| Mode | When | What is refused |
|---|---|---|
| **dev** | the tree is dirty, or the binary's stamp says `-dirty` / `unknown` | everything: no manifest is written, no verdict better than `NOT_A_RELEASE` |
| **beta** | the version has a pre-release suffix (`0.6.0-beta.2`) | a build from another commit or version; a manifest that does not match; unsigned **unless** `--allow-unsigned` / the workflow's `allow_unsigned` input was given, which is recorded in the manifest |
| **release** | the version has no suffix (`1.0.0`) | everything a beta refuses, **plus** any unsigned artefact, any signature without a timestamp countersignature, `--allow-unsigned` itself (exit 3, no override), a missing CI run, a missing clean-machine log, and — for the verdict — the external items (pentest, legal) |

The mode is derived from the version and the tree. A flag can *lower* it (a build can be
declared a beta while the version says release only by changing the version; a `--mode release`
on a pre-release version is refused) and nothing can raise it. In `release.yml` the same rule:
the mode comes from the tree's version and from whether a certificate is present; the
`allow_unsigned` input records a decision for a beta, it does not turn a release into one.

`PRODUCTION + UNSIGNED = SUCCESS` is not a state the scripts can reach:
`release_manifest.py --allow-unsigned` exits 3 on a release version
(`scripts/tests/test_release_manifest.py::test_a_production_version_cannot_be_published_unsigned`),
`release_check.py` marks `signing` FAIL on a release version without a valid, timestamped
signature (`test_release_check.py::test_a_release_version_unsigned_fails_on_signing`), and the
workflow fails on the same condition before uploading anything.

## What a person provides

Two repository secrets, nothing else:

| Secret | Contents | Never |
|---|---|---|
| `WINDOWS_CERTIFICATE` | the `.pfx`, base64 | in the tree, in a log, in an artefact |
| `WINDOWS_CERTIFICATE_PASSWORD` | its password | anywhere but the secret store |

`release.yml` decodes the `.pfx` to `$RUNNER_TEMP`, imports it into the runner's user store,
deletes the file, and hands Tauri the certificate's **thumbprint** as a `--config` overlay. The
thumbprint is an identifier, not a secret; it is still not committed. The key never leaves the
store, and the store dies with the runner.

Secrets are not available to workflows triggered by a pull request from a fork; the release
workflow runs on tags and on manual dispatch only, and `ci.yml` never references them. That is
the separation between *PR CI* and the *trusted release pipeline*: the same repository, two
workflows, and only one of them can see a credential.

## Failure modes, each of which fails cleanly

| Situation | Where it stops | How it is known to stop there |
|---|---|---|
| No certificate at all | `release.yml`: the import step is skipped, the build is unsigned, `release_manifest.py --require-signature` exits 1 — or, for a beta with `allow_unsigned`, the manifest records the decision | verified against the real 0.5.0-beta.1 installer: exit 1, both artefacts listed as unsigned |
| Invalid `.pfx` or wrong password | the import step: `Import-PfxCertificate` throws, the job fails before the build | PowerShell's own behaviour; no artefact is produced |
| Certificate imported, signtool fails (expired, wrong EKU, no private key) | Tauri's build fails with signtool's error; nothing to hash | Tauri's bundler |
| Signed, but the timestamp server was unreachable | `signtool` fails the build when `timestampUrl` is set and cannot be reached; if a build ever got through, `release_check.py` marks `signing` FAIL for "signed without a timestamp countersignature" | `release_identity.signature()` reads `TimeStamperCertificate` |
| Signature present but invalid (tampered after signing) | `Get-AuthenticodeSignature` reports `HashMismatch`; the manifest records it as **broken**, worse than unsigned; `release_check` FAILs `signing` | `release_manifest.signature()` maps anything but `Valid`/`NotSigned` to broken |
| Unsigned release version with `--allow-unsigned` | `release_manifest.py` exit 3 | tested |

## What signing does and does not buy

A valid, timestamped signature lets a person establish who built the file and that it has not
changed since. It does **not** remove the SmartScreen warning on its own — reputation is
earned by downloads over time, per certificate, and `docs/SIGNING.md` carries what Microsoft
says about that as of 2026-08-29. It does not make the software safe, and no release note may
say it does.

## After the certificate exists

1. Add the two secrets.
2. Dispatch `release.yml` (or push the tag): the build job signs, verifies, regenerates the
   manifest from the signed artefacts under `--require-signature`, and uploads.
3. Download the artefact, run `python scripts/release_check.py --mode release --compare <dir>`
   against a local build of the same commit: the executable's code, data and debug bytes are
   identical and only the certificate table and the header checksum differ — `pe_diff.py`
   shows exactly that. A different result is a different program.
4. Commit the regenerated `docs/RELEASE.md` and `site.ts` as the publication commit; tag it.
5. Change the two "not signed" sentences (Settings → About, the download page) by hand — they
   are written as facts on purpose.
