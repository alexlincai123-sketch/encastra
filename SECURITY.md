# Reporting a security problem

**Do not open a public issue.** Send it to the address in the repository's contact details, or
open a private security advisory on the repository if you have access to do so.

Include what you would want if you were on the other end: what you did, what happened, what you
expected, and the smallest thing that reproduces it. A `.encastra` file that demonstrates the
problem is worth more than a description of one — and please say so if it is a file you would not
want anybody to open.

You will get an acknowledgement. This is a small project and there is no team behind the address,
so the honest expectation is days rather than hours.

## What is in scope

Encastra is a desktop application that runs a graph of components on your own machine. The parts
where a problem would matter most:

* **The project container.** A `.encastra` file is the one artefact of this product that travels
  between people. Anything a crafted one can do to somebody who opens it — read a file it should
  not reach, write outside a folder they allowed, consume memory without bound, run something —
  is in scope and is the highest-value thing to look for.
* **The capability broker.** Components hold opaque handles, never paths. A way for a component
  to reach the filesystem, the network or a handle it was not given is in scope.
* **The permission model.** A way to obtain a grant a person did not actually agree to — because
  the prompt showed one thing and the runtime did another, or because a grant covered more than
  it appeared to — is in scope. The prompt is drawn by a webview, which is the known weak point
  here; see `docs/security/THREAT_MODEL.md`.
* **The desktop IPC boundary.** The renderer is treated as untrusted. Anything it can make the
  privileged side do that a person did not ask for is in scope.
* **The website.** It is static, has no accounts and makes no outbound requests, so the surface
  is small — but an open redirect, a way to bypass the content-security policy, or anything that
  turns a visit into a download of something other than what was offered, is in scope.

## What is known and does not need reporting

These are documented, not hidden. `docs/security/` has the detail.

* **Releases are not code-signed and there is no updater.** An installer downloaded from anywhere
  other than the official source cannot be verified beyond its published hash. This is the
  largest open item and it is blocked on a certificate, not on a patch.
* **The permission prompt is rendered by the webview.** The runtime independently refuses grants
  a component never declared, and refuses absurd folder scopes, but the prompt itself is not yet
  drawn by the privileged side.
* **Hard links cannot be detected.** On Windows, somebody who can already write into a folder you
  have granted can hard-link a file from elsewhere on the same volume into it. Canonicalisation
  cannot see this — a hard link has no target, it *is* the file.
* **There is no per-node timeout.** A component that hangs hangs its run. A run has an outer time
  limit; a single step does not.
* **Third-party components do not exist yet.** There is no way to write one, so the isolation
  design for them is untested by construction. Please do not report it as unverified — it is.

## What this project will not do

It will not tell you the problem is out of scope because it is inconvenient, and it will not
describe a fix as complete when it is partial. If something cannot be fixed, it goes in
`docs/security/` as a residual risk with its reason.

There is no bug bounty.
