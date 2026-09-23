/**
 * The nine legal documents this site publishes.
 *
 * Every one of them is a draft. None has been reviewed by a lawyer, and `/legal` says so above
 * every single document rather than once in a footer — the same discipline `docs/BRANDING.md`
 * applies to the trademark question these drafts inherit. Nothing here should be read as a
 * finished policy; it exists so a reader can see what the project currently intends to promise,
 * and so a future review has a concrete draft to correct rather than a blank page.
 *
 * Facts asserted in these drafts (no accounts, no payments, no analytics, the source proprietary
 * under `LICENSE`, builds not signed) are drawn from `docs/SECURITY.md`, `docs/PROJECT-FORMAT.md`,
 * `docs/PRODUCT-ROADMAP.md`, `docs/BRANDING.md`, `docs/RELEASE.md` and `lib/security.ts`, and
 * should stay in step with them.
 */

export interface LegalSection {
  readonly heading: string;
  readonly body: readonly string[];
}

export interface LegalDoc {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly LegalSection[];
}

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    summary:
      'What is collected, by the website and by the desktop application. Today: very little.',
    sections: [
      {
        heading: 'The desktop application',
        body: [
          'Encastra runs on your own machine. A workflow you build and run stays there — it is not uploaded anywhere, there is no account to create, and no model or service decides anything about it on your behalf.',
          'The application does not collect telemetry, usage analytics, or crash reports in this build. If that changes in a later release, it will be opt-in and disclosed here before it ships, not folded into an update note.',
          'A saved .encastra file is a plain archive on your disk. It cannot contain a secret value — the project format has no field that would hold one — and the application does not read it anywhere but the folder you saved it to.',
        ],
      },
      {
        heading: 'This website',
        body: [
          'This site loads no third-party script, no third-party font, no analytics, and no embeds — see the Content-Security-Policy enforced on every response. It sets no cookies of its own.',
          'If and when this site is hosted publicly, its infrastructure provider may record ordinary technical information about requests — such as an IP address and a timestamp — the way most web hosting does. That is a property of hosting, not a choice this project has made about tracking, and no such data is used for anything beyond operating the site.',
        ],
      },
      {
        heading: 'Accounts and payments',
        body: [
          'There are no user accounts, no sign-in, and no payments in this build. When those exist, this document will describe exactly what they collect and why, before they collect anything.',
        ],
      },
      {
        heading: 'Contact',
        body: [
          'There is no dedicated privacy contact address published yet. See /contact for what channels currently exist.',
        ],
      },
    ],
  },
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    summary: 'Beta software, provided as is, with no accounts and no payments to speak of yet.',
    sections: [
      {
        heading: 'What this covers',
        body: [
          'These draft terms cover your use of this website and of the Encastra desktop application beta. They are not the source code licence: that is a separate document, `LICENSE` in the repository, and it is proprietary — see the note below.',
        ],
      },
      {
        heading: 'Beta software, provided as is',
        body: [
          'The application is pre-release software. It is provided without warranty of any kind, express or implied, including any warranty of merchantability, fitness for a particular purpose, or non-infringement.',
          'Known limitations are documented, not hidden — see /security for the capability model’s stated limits, and docs/BETA-0.2.md in the repository for what this specific release does and does not change.',
        ],
      },
      {
        heading: 'What the software does on your machine',
        body: [
          'The application runs workflows you build, using components you choose, against permissions you grant per run. It does not act on your files, network, clipboard, or notifications beyond what a component declares and you allow.',
        ],
      },
      {
        heading: 'No accounts, no payments, no marketplace',
        body: [
          'None of these exist today. This document will be extended, not silently reinterpreted, when they do.',
        ],
      },
      {
        heading: 'Source code licence',
        body: [
          'Encastra is proprietary. The repository is public so the source can be read and its checks can run in the open, and the terms are in the LICENSE file at its root. That is not an open-source licence: no general right to copy, modify, redistribute or build works derived from it is granted, and anything wider has to be granted in writing. Third-party dependencies keep their own licences.',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'Because this entire document is a draft pending legal review, expect it to change materially, not just incrementally, before it is finalised.',
        ],
      },
    ],
  },
  {
    slug: 'eula',
    title: 'End User License Agreement',
    summary:
      'The terms under which the Windows installer grants you a licence to run the application.',
    sections: [
      {
        heading: 'Grant',
        body: [
          'Subject to these terms, you are granted a limited, personal, non-exclusive, non-transferable licence to install and run the Encastra desktop application for your own use.',
        ],
      },
      {
        heading: 'What you may not do',
        body: [
          'You may not redistribute the installer or binary as your own product, remove or alter any notices it displays, or use it in a way that violates applicable law.',
        ],
      },
      {
        heading: 'No warranty, no support commitment',
        body: [
          'The application is provided as is, without warranty, and without any commitment to provide support, bug fixes, or updates on any schedule. There is currently no update mechanism at all — see /download for exactly what that means today.',
        ],
      },
      {
        heading: 'Not code-signed',
        body: [
          'This build is not code-signed. Installing it means trusting a binary that Windows itself flags as coming from an unrecognised publisher. See /download and /security for what verification is possible today (a published SHA-256) and what it does and does not prove.',
        ],
      },
      {
        heading: 'Termination',
        body: [
          'This licence ends automatically if you breach these terms. Uninstalling the application ends it without any breach implied.',
        ],
      },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    summary:
      'The short version: do not use this to break the law, and do not try to defeat the permission model.',
    sections: [
      {
        heading: 'Lawful use only',
        body: [
          'Do not use Encastra, or any workflow built with it, to violate applicable law, infringe anyone’s rights, or cause harm to a person, system, or network you do not own or have permission to affect.',
        ],
      },
      {
        heading: 'Do not try to defeat the permission model',
        body: [
          'The capability broker exists to make it obvious what a component can and cannot reach. Attempting to construct a manifest, a graph, or an input specifically to bypass a declared capability, forge a handle, or reach a filesystem location the broker did not grant is a misuse of the product, independent of whether it succeeds.',
        ],
      },
      {
        heading: 'Reporting rather than exploiting',
        body: [
          'If you find a way around the permission model, that is exactly the kind of report the project wants — see /legal/security-disclosure for how to report it privately rather than using it.',
        ],
      },
    ],
  },
  {
    slug: 'security-disclosure',
    title: 'Security Disclosure Policy',
    summary:
      'How to report a vulnerability privately. There is no bug bounty and no public address yet.',
    sections: [
      {
        heading: 'Please do not open a public issue',
        body: [
          'A public report starts a clock that the people who can fix it may not be able to beat. Report privately instead.',
        ],
      },
      {
        heading: 'Where to report',
        body: [
          'A published security@ address does not exist yet — the domain in this project’s identifiers is not registered, so any address inferred from this site goes nowhere. Until one is published, use the repository host’s private vulnerability reporting, or contact the maintainer directly through a channel listed on /contact.',
        ],
      },
      {
        heading: 'What to include',
        body: [
          'What you found; which component, crate, or file; the version or commit; what an attacker gains; and the smallest reproduction you can manage. A graph file, a manifest, or a crafted input is ideal — the runtime is deterministic and a reproduction usually replays exactly.',
        ],
      },
      {
        heading: 'What to expect',
        body: [
          'An acknowledgement that a human has read it, an assessment of scope and severity, and honesty about timelines rather than a promised date that slips. Fixes to the broker, the type system, or the project format are treated as release blockers. There is no bug bounty.',
        ],
      },
      {
        heading: 'Particularly wanted',
        body: [
          'A way to make the broker allow something it should not; a path that reaches the filesystem or network without passing through it; a handle that resolves to something the graph did not wire; anything that puts user content, a path, or a secret into the journal or a log; and anything that makes a .encastra file carry a value it should not.',
        ],
      },
      {
        heading: 'Scope',
        body: [
          'In scope today: the runtime, the broker, the project format, the manifest validator, the first-party components, the CLI, and the desktop shell. Out of scope today, because they do not exist: the WebAssembly host, the registry, signing and revocation, the backend API, the marketplace, and the update channel. A finding in one of those is still worth reporting — it means a design document needs attention.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie & Tracking Notice',
    summary: 'This one is short, because this site sets none.',
    sections: [
      {
        heading: 'What this site sets',
        body: [
          'Nothing. This website does not set cookies, does not run analytics, and does not embed any third-party tracker. Its Content-Security-Policy blocks any script that is not served from this site itself.',
        ],
      },
      {
        heading: 'Local storage in the desktop application',
        body: [
          'The desktop application stores your project files and its own settings on your machine, using ordinary application storage — not a tracking mechanism, and not something the website has any access to.',
        ],
      },
      {
        heading: 'If that ever changes',
        body: [
          'Adding any tracker or analytics script would be a change to this document before it is a change to the site — not the other way around.',
        ],
      },
    ],
  },
  {
    slug: 'trademark',
    title: 'Intellectual Property & Trademark Notice',
    summary:
      '"Encastra" is a working name. Trademark clearance has not happened. See /about for the full story.',
    sections: [
      {
        heading: 'The name is not cleared',
        body: [
          'Encastra was chosen from a researched shortlist and checked for npm, GitHub, and domain availability, but trademark registers (USPTO, EUIPO, TMview) have not been searched. An available handle is not trademark clearance, and nobody associated with this project states that the name is legally clear.',
        ],
      },
      {
        heading: 'No ™ or ®',
        body: [
          'Consistent with that, no trademark symbol appears anywhere on this site or in the application, and none should be inferred.',
        ],
      },
      {
        heading: 'What this project does not use',
        body: [
          'The product was originally developed under a different working name referencing a well-known third-party brick toy. That name, and any reference to it, has been deliberately and permanently removed from all public copy, domains, repository names, and marketing material, and will not reappear.',
        ],
      },
      {
        heading: 'Source and content',
        body: [
          'The source code is proprietary and its terms are in the repository’s LICENSE file — see /legal/terms-of-service. This notice covers naming and branding only, and is not a grant of rights to any code.',
        ],
      },
    ],
  },
  {
    slug: 'third-party-notices',
    title: 'Third-Party & Open-Source Notices',
    summary:
      'What this project is built on: a generated inventory of every dependency compiled into the application, with its licence and origin.',
    sections: [
      {
        heading: 'What this build depends on',
        body: [
          'Encastra is built on open-source software, including the Rust toolchain and its crate ecosystem, Node.js, React, Next.js, and Tauri, each under its own licence. The complete list is generated from the dependency tree rather than written by hand: docs/THIRD-PARTY.md in the repository names every crate compiled into the desktop executable and every npm package bundled into its interface, with version, licence and origin. The build fails if that file no longer matches the tree.',
        ],
      },
      {
        heading: 'What the inventory is and is not',
        body: [
          'It is an inventory. It lists each package’s licence identifier and where its source, and therefore its full licence text, lives. It does not reproduce every licence text inline, and it is not a legal opinion about what each licence obliges; a review of those obligations by counsel is among the steps before a non-beta release, alongside code signing. Encastra’s own licence is settled: it is proprietary, and its terms are in the repository’s LICENSE file.',
        ],
      },
      {
        heading: 'Requesting the list',
        body: [
          'The generated file ships with the source tree. If you need it for compliance purposes and do not have the repository, ask through /contact and it will be sent as generated for the release you name.',
        ],
      },
    ],
  },
  {
    slug: 'refunds',
    title: 'Refund & Cancellation Policy',
    summary:
      'Nothing is sold today, so there is nothing to refund. This exists for when that changes.',
    sections: [
      {
        heading: 'Nothing is sold',
        body: [
          'There are no payments, no subscriptions, and no paid plans anywhere in this build. The download is free, and there is no purchase to cancel or refund.',
        ],
      },
      {
        heading: 'When payments exist',
        body: [
          'The product roadmap treats payments as a sandboxed, later-stage capability, arriving well after a working marketplace listing model — real money movement is explicitly out of scope for the current milestone. This document will be rewritten with real terms before that capability ships, not adapted retroactively after it does.',
        ],
      },
    ],
  },
] as const;

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
