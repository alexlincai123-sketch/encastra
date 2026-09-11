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

| Option | Cost | SmartScreen | Key storage |
|---|---|---|---|
| **OV certificate** | roughly €200–400/yr | Reputation builds over downloads; early users still see a warning | Hardware token required since June 2023 |
| **EV certificate** | roughly €300–600/yr | Immediate SmartScreen reputation | Hardware token or HSM, always |
| **Azure Trusted Signing** | pay per use, much cheaper to start | Same as OV | Microsoft-held; no token to lose |

Since 2023 every code-signing certificate requires the key to be on hardware — a token or an
HSM. That has one consequence worth planning for: **signing cannot happen on an unattended CI
runner** unless the service is cloud-based. Azure Trusted Signing is the option that keeps CI
signing possible; a token means a person signs the release on a machine with the token plugged
in.

## The procedure once a certificate exists

1. Install the certificate into the Windows certificate store, or configure the cloud service.
2. Read its thumbprint:
   ```powershell
   Get-ChildItem Cert:\CurrentUser\My | Select-Object Subject, Thumbprint
   ```
3. Put the thumbprint in `tauri.conf.json` — it is not a secret; it identifies a certificate,
   it does not authorise use of it.
4. `npm run tauri:build`.
5. Verify, and do not skip this:
   ```powershell
   Get-AuthenticodeSignature .\Encastra_<version>_x64-setup.exe | Format-List
   ```
   `Status` must be `Valid` and the timestamp must be present.
6. Regenerate `docs/RELEASE.md` with `python scripts/release_manifest.py` — the hash changes,
   because signing changes the file.
7. Update the "not signed" statements in Settings → About, the download page and
   `apps/web/src/config/site.ts` (`signed: false`). **They are deliberately written as facts, not
   as placeholders, so they have to be changed by hand when the fact changes.**

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
- `docs/BETA-0.3.md` — where this sits among everything else outstanding
