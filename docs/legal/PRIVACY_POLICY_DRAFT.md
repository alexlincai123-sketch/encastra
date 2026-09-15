# Privacy statement — DRAFT, not in force

*Draft for a lawyer. Everything in it is true of the software today; whether it is sufficient,
and in which jurisdictions, is theirs to say. `[…]` marks a business fact the owner supplies.*

## What Encastra does with your data

**Nothing leaves your computer unless a workflow you built and allowed sends it.**

Encastra is a desktop application. It has no account, no login, no server of its own, no
telemetry, no crash reporting and no update check. The application does not contact
`[COMPANY]` or anybody else on its own. This is verified by the project's own tests and can be
verified by you with a network monitor: with no workflow running, the process opens no
connection.

### What the application stores, and where

| What | Where | Why |
|---|---|---|
| Your preferences (language, default project folder, editor settings) | `%APPDATA%\dev.encastra.app` | so they are there next time |
| Your library of imported publications | `%LOCALAPPDATA%\Encastra\library` (per user) | so imports are available offline |
| Your projects (`.encastra` files) | wherever you save them | they are your files; the application keeps no hidden copy |
| Temporary files during a run | `%TEMP%\encastra\run-<id>`, removed when the run ends | scratch space |

Uninstalling removes the application and leaves your projects and, deliberately, your
preferences. Nothing is stored anywhere else.

### What a workflow may do

A workflow is a graph of components you assemble. A component acts only within a permission you
granted it in a prompt — a folder you chose in the system's own folder chooser, a network host
and port you approved. A workflow that sends data to a host does so because you granted that host.
The prompt names what is being asked; the runtime, not the editor, decides what was granted.

### What `[COMPANY]` receives

Nothing from the application. If you write to `[SUPPORT ADDRESS]`, we receive what you send.
If you download the installer from `[SITE]`, the web server sees the request as any web server
does (`[hosting provider]`, `[what its logs keep and for how long]`).

### Publications you import

A publication is a folder somebody else made. Its `publication.json` states a publisher name
that **is not verified by anybody** — there is no registry, no signature, no account. Treat the
name as a label the file carries, not as an identity.

### Children, sensitive data, automated decisions

The application is a general tool and does not know what your files contain. It makes no
decision about you. `[Jurisdiction-specific statements, per the lawyer.]`

### Changes

This statement describes version `[VERSION]`. A version that changes any of the facts above
ships with a changed statement, and Settings → About shows which version you have.

### Contact

`[COMPANY]`, `[ADDRESS]`, `[PRIVACY CONTACT]`. `[Supervisory authority, if applicable.]`
