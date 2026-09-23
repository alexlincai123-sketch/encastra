# Code signing

**Status: prepared, not done. Blocked on a certificate, which costs money and is somebody's
decision to make.**

Encastra's installers are **not signed**. Windows SmartScreen warns about an unrecognised
publisher, and that warning is accurate: nothing in the file proves who produced it. The
application says so in Settings → About, the download page says so next to the hash, and
`RELEASE.md` says so next to the hash. None of that changes until a certificate exists.

---

## What is already configured

`apps/desktop/src-tauri/tauri.conf.json` carries the half of the configuration that needs no
credential:

```json
"windows": {
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com"
}
```

- **`digestAlgorithm: sha256`** — SHA-1 signatures are not trusted by current Windows.
- **`timestampUrl`** — a countersignature from a timestamping authority, so signatures stay
  valid after the certificate itself expires. Without it, everything signed becomes untrusted
  the day the certificate lapses, including copies already installed. It is plain `http` by
  design: RFC 3161 timestamping is its own signed protocol and does not use TLS.

Adding these now means the only remaining change is one value.

## What is missing

**One line**, plus the certificate behind it:

```json
"certificateThumbprint": "<the SHA-1 thumbprint of the certificate in the machine store>"
```

Tauri then calls `signtool` with that thumbprint. The private key never appears in the
configuration; it lives in the certificate store or on a hardware token.

## What has to be decided and bought

Checked against Microsoft's own comparison page on 2026-09-15
(learn.microsoft.com, *Code signing options for Windows app developers*, dated 2026-08-29).
An earlier version of this table said an EV certificate bought immediate SmartScreen reputation;
Microsoft removed that in 2024, and this table now says what the page says.

| Option | Cost | SmartScreen | Who can get it | Key storage |
|---|---|---|---|---|
| **Azure Artifact Signing** (was "Trusted Signing") | about $9.99/month, 5 000 signatures, one profile | Reputation builds over downloads; first releases still warn | Organisations in the USA, Canada, EU, UK. **Individuals: USA and Canada only** | Microsoft-held HSM; signs from CI, no token |
| **OV certificate** (DigiCert, Sectigo, GlobalSign, SSL.com…) | about $150–300/year | Same as above | Anyone, worldwide; identity of the person or organisation validated | Hardware token or the CA's cloud HSM, required since June 2023 |
| **EV certificate** | $400+/year | **Same as OV since 2024** — no longer an instant pass | Organisations; some CAs sell a sole-proprietor EV | HSM, always |
| **Microsoft Store (MSIX)** | free | No warning; the Store re-signs | Store developer account | — |
| **SignPath Foundation** | free | OV-level | Qualifying open-source projects only | Managed |
| Self-signed / none | free | Blocked or strongly warned | — | — |

What that means for this project, as it is today:

- The publisher is one person in Spain. **Azure Artifact Signing is closed to that person as an
  individual** (individuals: USA and Canada only). It opens if the publisher is an EU-registered
  organisation — which is the legal-identity decision `docs/LICENSING.md` and `docs/BRANDING.md`
  already wait on.
- Until then the route that exists is an **OV certificate as an individual** (identity-validated:
  passport, proof of address, a video call at some CAs) with the key on a USB token the CA ships
  or in the CA's cloud HSM. A token means a person signs on a machine with the token in it; a
  cloud HSM (SSL.com eSigner, DigiCert KeyLocker, and others) keeps the CI path in
  `release.yml` usable.
- SmartScreen will warn on the first signed releases whichever option is chosen. A consistent
  signing identity across releases is what makes the warning go away; changing certificates
  starts the count again.
- The Store is not a route for this product as it is: it is a Win32 NSIS installer, not MSIX,
  and Store distribution would need an MSIX package and a listing the project has not designed.
- SignPath's free programme requires an open-source licence. Encastra's is proprietary
  (`LICENSE`), so that route is closed — making the repository public does not change it.

None of this can be done from the repository. It needs a legal identity (person or company),
money, and an identity-validation process with a CA or Microsoft. That is the external blocker,
and `release_manifest.py --require-signature` refusing is the only correct state until it lifts.

## The procedure once a certificate exists

1. Install the certificate into the Windows certificate store, or configure the cloud service.
2. Read its thumbprint:
   ```powershell
   Get-ChildItem Cert:\CurrentUser\My | Select-Object Subject, Thumbprint
   ```
3. Give Tauri the thumbprint as a config overlay, **not** by editing `tauri.conf.json`: the
   binary records whether it was built from a clean commit, and an edited tracked file makes the
   build `-dirty`, which the manifest refuses. The thumbprint is not a secret; it identifies a
   certificate, it does not authorise use of it.
   ```powershell
   '{"bundle":{"windows":{"certificateThumbprint":"<thumbprint>"}}}' | Set-Content $env:TEMP\signing.json
   npm run tauri:build -- --config $env:TEMP\signing.json
   ```
   This is what `.github/workflows/release.yml` does with the certificate from its secrets.
4. Verify, and do not skip this:
   ```powershell
   Get-AuthenticodeSignature .\Encastra_<version>_x64-setup.exe | Format-List
   ```
   `Status` must be `Valid` and the timestamp must be present.
5. Regenerate the manifest with `python scripts/release_manifest.py --require-signature` — the
   hash changes, because signing changes the file. It rewrites `docs/RELEASE.md` and the
   `RELEASE` constant in `apps/web/src/config/site.ts`, `signed: true` included, from what
   Windows says about the files rather than from anything typed.
6. Update the "not signed" statement in Settings → About and on the download page. **They are
   deliberately written as facts, not as placeholders, so they have to be changed by hand when
   the fact changes.**
7. A signed build is no longer byte-identical to an unsigned rebuild of the same commit — the
   signature is appended. `scripts/pe_diff.py` shows exactly which bytes; everything outside the
   certificate table and the header checksum must still be identical.

## Rules for when it happens

- **The key never enters the repository**, never a CI log, never an environment variable that
  gets echoed. The thumbprint may; the key may not.
- **The updater's signing key is separate** from the code-signing certificate. Losing it means no
  installed copy can ever be updated again, so it is backed up before the first release that
  uses it. See `docs/UPDATES.md`.
- **A signature is not a security review.** It proves who built the file, not that the file is
  safe. Signing must never be described as if it were the audit that has not happened.

## Related

- `docs/RELEASE.md` — what a build produces and how to verify it today
- `docs/UPDATES.md` — the update channel, also not built
- `docs/BETA-0.5.md` — where this sits among everything else outstanding
- `docs/RELEASE_CANDIDATE_READINESS.md` — the blocker table this feeds
