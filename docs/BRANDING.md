# BRANDING

## The name: Encastra

Chosen in Phase 0 from a researched shortlist. Working name — see the legal status below
before it goes on anything public.

**Why.** *Encastrar* is a real Spanish verb, from Latin *incastrare*: to interlock or couple
two pieces so that each holds the other. The Real Academia Española glosses it as "endentar o
acoplar dos piezas". That is the product, stated in one word, without borrowing anyone's
trademark.

It also gives the ecosystem its vocabulary, which most candidate names do not:

- a verb — *"encastra tu stack"*, "components that encastra"
- a noun for the joint itself — *el encastre*, which is what the component protocol specifies
- pronounceable and spellable in Spanish and English, with no unfortunate meaning in either

**What was checked, on 11 Sept 2026:**

| Check | Result |
|---|---|
| npm `encastra` | not registered |
| GitHub org `encastra` | unclaimed |
| `encastra.dev`, `encastra.io` | appear unregistered |
| `encastra.com` | registered (2020, Tucows) but resolves to nothing — no live site |
| Companies / products named Encastra | none surfaced in search, in any industry |
| Dev-tools collision | none surfaced |

**What was NOT checked, and matters:** trademark registers. USPTO, EUIPO and TMview could not
be queried directly during research. **An available npm handle is not trademark clearance.**
Nobody may state that this name is legally clear.

### Before the name is used publicly

1. Professional knockout and full clearance search, classes 9 and 42, US + EUTM + ES national.
2. Acquire `encastra.dev` (launch TLD) and attempt a broker approach on the dormant `.com`.
3. Claim the npm scope and GitHub org.
4. Only then: put the name on a website, an installer, or a deck.

Until step 1 comes back clean, treat the name as **reversible**. In the source it appears as the
`@encastra/*` npm scope, the `encastra-*` crate names and the `.encastra` project extension; in
what ships it also appears as the product name and window title (`tauri.conf.json`), the
bundle identifier `dev.encastra.app` (which names the library folder under `%APPDATA%`), the
installer's file name and its uninstall entry, and the per-user install folder
`%LOCALAPPDATA%\Encastra`. All of it derives from `tauri.conf.json` and the crate names, so a
rename is one scripted commit plus a version bump — the `.encastra` extension and the app-data
folder are the two shapes an installed copy would notice. That is deliberate.

---

## The name that was rejected: "Digital LEGO"

The original codename. It cannot be the public brand, and the working tagline "Build software
like LEGO" carries real risk of its own.

- The LEGO Group's published rules state the mark must never be used as a noun, must carry ®,
  and — decisively — that **"The LEGO trademark should not be incorporated into an Internet
  address"**, because doing so creates a misleading impression of sponsorship. They also state
  that a disclaimer "will not serve to undo an improper trademark use."
- "Different industry" is not a defence here: LEGO Juris A/S holds US registrations that
  expressly cover **downloadable computer software in class 9**, and has around eighty US
  filings.
- Enforcement is active and well documented — litigation against Mega Bloks, Lepin and Laser
  Pegs, action against individual creators, and a 2023 Chinese decision extending protection
  across classes as a well-known mark.

The asymmetry is what settles it: a cease-and-desist *after* launch costs the domain, the npm
scope, the docs, the SEO and the deck. Before launch it costs nothing.

**Rule for this repository:** "LEGO" never appears in public copy, a domain, a repository
name, a package name, or marketing material. It may appear in internal history — such as this
document — to record why.

> This is desk research, not legal advice. Every conclusion here needs review by a qualified
> trademark attorney before it is relied upon.

---

## Taglines under consideration

None reference LEGO. All are provisional.

- **Every part fits.** / *Todo encastra.*
- Sandboxed components. Whole systems.
- Assemble it. Ship it. Swap it.
- Software, assembled.

Rejected: anything with "revolutionary", "AI-powered", or "the world's best". Also rejected —
any claim about users, revenue, customers, or awards, since there are none.

---

## Visual identity

Built, and built as code: `scripts/make_brand.py` draws every asset from one geometry. Nothing
here is hand-edited, and changing the shape means changing the script and re-running it — which
is what stops the favicon slowly disagreeing with the application icon.

The constraints it was designed under, all still binding:

- **Original.** No LEGO stud, no interlocking-brick silhouette, no third-party icon set traced
  into a logo. The idea to express is *modules that connect*, not *a toy brick*.
- Must survive at 16 px and in one colour.
- One system shared by the desktop application and the website, not two that drift.

An earlier draft of the mark was symmetrical and read as the letter H. The version that shipped
is deliberately staggered — two parts offset so that one plainly slots into the other — because
symmetry in a small glyph reads as a letter rather than as a joint.

### What exists

| Asset | Where | For |
|---|---|---|
| `mark-accent.svg`, `mark-current.svg` | `packages/ui/brand/` | The mark. `current` takes `currentColor`, so one file serves light, dark and inside a button |
| `wordmark-accent.svg`, `wordmark-on-dark.svg`, `wordmark-current.svg` | `packages/ui/brand/` | The mark beside the name, which is what a site header needs |
| `mark-accent/light/dark/on-dark.png` | `packages/ui/brand/` | Raster, 512 px, for anywhere SVG is awkward |
| `favicon.png` | `packages/ui/brand/` | 32 px |
| `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.ico` | `apps/desktop/src-tauri/icons/` | The application icon. The `.ico` carries 16 through 256 in one file |

The wordmark sets the name as `<text>` rather than as outlines. Outlines would make the file
self-contained but would freeze a typeface into it, and this repository ships no font it has the
right to embed. The stack ends in a generic family, so it degrades sanely; the two places that
matter already load the UI font.
