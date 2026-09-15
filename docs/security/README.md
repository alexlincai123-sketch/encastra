# Security documentation

Where to look for what.

| Document | Answers |
|---|---|
| [`../../SECURITY.md`](../../SECURITY.md) | How to report a problem, what is in scope, what is already known. |
| [`../THREAT-MODEL.md`](../THREAT-MODEL.md) | Who the adversary is at each boundary, what stops them, and what does not. Boundaries T1–T8; only T7 and T8 exist today. |
| [`../SECURITY.md`](../SECURITY.md) | What the capability broker, handles, filesystem and network controls actually do, as implemented. |
| [`LIMITS.md`](LIMITS.md) | Every ceiling this build enforces, its value, what it bounds and why. |
| [`RELEASE_SECURITY.md`](RELEASE_SECURITY.md) | What must be true before an installer leaves. Gates, signing, hashes, the licence decisions on record, and the clean-install procedure. |
| [`../../fuzz/README.md`](../../fuzz/README.md) | The libFuzzer targets, the corpus, and what runs on stable in CI instead. |
| [`../SIGNING.md`](../SIGNING.md) | Certificate options, and the procedure once one exists. |
| [`../audits/`](../audits/) | Point-in-time reviews. Each says what was verified on the machine that ran it and what was not. |

## The shape of the argument

Three things carry most of the weight, and they are worth stating plainly because everything else
is detail hanging off them.

**Components hold handles, not paths.** A component asks the broker for handle 7; it never names a
file. Path traversal is not blocked, it is unrepresentable. This is the control that makes the
rest cheap.

**The broker is the only code that touches OS authority, first-party components included.** There
is no faster path for trusted code, because a control some code can bypass is not a control — and
because the permission dialog and the capabilities panel are drawn from what the broker enforces,
so they cannot lie about it.

**The privileged side decides, and does not take the editor's word for anything.** The editor is a
webview that renders strings out of files other people wrote. It relays what a person agreed to;
it does not establish it. Grants are checked against the component's own manifest, folder scopes
are resolved and bounded, and the folder chooser is opened by the runtime so that a granted folder
is one somebody actually picked.

## What is known to be missing

Listed here rather than only in the threat model, because a reader who gets this far should not
have to go looking.

* Releases are unsigned and there is no updater.
* The consent prompt is still rendered by the webview; only its content is constrained.
* There is no per-node timeout, and no aggregate memory ceiling across a run.
* Hard links cannot be detected.
* Third-party components do not exist, so their isolation design is untested by construction.
* Nothing here has been audited by anybody outside the project.
