import type { Messages } from '../messages';

/**
 * English. The fallback for every locale, always — see `translate.ts`. Every key any page reads
 * must exist here even if it also exists in `es.ts`, because a missing English key has nowhere
 * left to fall back to.
 */
const en: Messages = {
  a11y: {
    skipToContent: 'Skip to content',
  },

  header: {
    navAriaLabel: 'Main',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    download: 'Download',
  },

  nav: {
    primary: {
      features: 'Features',
      howItWorks: 'How it works',
      components: 'Components',
      templates: 'Templates',
      learn: 'Learn',
      security: 'Security',
    },
    footer: {
      groups: {
        product: 'Product',
        learn: 'Learn',
        ecosystem: 'Ecosystem',
        legal: 'Legal',
      },
      items: {
        features: 'Features',
        howItWorks: 'How it works',
        components: 'Components',
        templates: 'Templates',
        download: 'Download',
        pricing: 'Pricing',
        tutorials: 'Tutorials',
        docs: 'Documentation',
        security: 'Security',
        marketplace: 'Marketplace',
        community: 'Community',
        about: 'About',
        contact: 'Contact',
        allDocuments: 'All documents',
        privacy: 'Privacy',
        terms: 'Terms',
        reportVulnerability: 'Report a vulnerability',
      },
    },
  },

  footer: {
    navAriaLabel: 'Footer',
    versionLine: 'Beta {version} · Windows only · builds are not code-signed',
    legal: {
      // Split into a prefix and the link's own text, rather than one sentence with a `{link}`
      // placeholder — `Footer.tsx` wraps `nameLinkText`/`licenceLinkText` in a real `<Link>`, and
      // two whole, separately-translated fragments read correctly in any word order a
      // translation needs, where flattening a `<Link>` into an interpolated string would not.
      namePrefix:
        'Encastra is a working name. The trademark registers have not been searched, so nothing here claims the name is legally clear —',
      nameLinkText: 'why that is written down',
      licencePrefix:
        'No licence has been chosen for the source. The legal documents on this site are',
      licenceLinkText: 'unreviewed drafts',
    },
  },

  theme: {
    changeTheme: 'Change theme',
    switchTo: 'Switch to {theme} theme',
    light: 'light',
    dark: 'dark',
  },

  language: {
    label: 'Language',
    switchTo: 'Switch to {language}',
  },

  status: {
    built: 'Available',
    preview: 'Preview',
    designed: 'Designed, not built',
    planned: 'Not built',
  },

  /** Mirrors `config/site.ts`'s `SITE.tagline` / `SITE.description` — kept here, not there,
      because `site.ts` is facts (a version, a hash, a URL), never copy. See that file's own
      comment. */
  site: {
    tagline: 'Build software by assembling components.',
    description:
      'Encastra is a local-first desktop application that runs a typed graph of components. Pick components, connect them, grant permissions, press run. Everything happens on your machine.',
  },

  home: {
    whatExists: {
      eyebrow: 'What exists today',
      title: 'A working engine, not a mockup',
      lead: 'Every claim in the scenes above is either a shipped test or a component you can open in the palette. What is designed and not built is labelled that way, in the same place, every time.',
      runtime: {
        title: 'Runtime',
        body: 'Validation, scheduling, capability enforcement, and a journal of what ran.',
      },
      capabilityBroker: {
        title: 'Capability broker',
        body: 'The only code that touches OS authority — including for components that ship with the product.',
      },
      projectFormat: {
        title: 'Project format',
        body: 'A deterministic .encastra file: graph, lockfile, variables, version history.',
      },
      thirdParty: {
        title: 'Third-party components',
        body: 'The WebAssembly sandbox is designed and documented. Nothing third-party runs yet.',
      },
    },
    availability: {
      eyebrow: 'Availability',
      title: 'Windows only, for now',
      lead: 'Encastra runs on Windows 10 and 11, 64-bit. There is no macOS build and no Linux build — not "coming soon", not hidden behind a waiting list: they do not exist, and a download button that produced nothing would be worse than saying so.',
      platforms: {
        windows: {
          name: 'Windows',
          detail: '10 and 11 · x64 · per-user installer, no administrator needed',
          state: 'Available',
        },
        macos: {
          name: 'macOS',
          detail:
            'Not built. The runtime is portable Rust, so it is a matter of work rather than of possibility.',
          state: 'Not available',
        },
        linux: {
          name: 'Linux',
          detail: 'Not built, for the same reason.',
          state: 'Not available',
        },
      },
      note: 'The installer is not code-signed, so Windows will warn about an unrecognised publisher. That warning is accurate. The published SHA-256 is what you have instead of a signature.',
    },
    closing: {
      eyebrow: 'Beta {version}',
      title: 'Windows only, not code-signed, and honest about both',
      lead: 'SmartScreen will warn about an unrecognised publisher. That warning is accurate — nothing in the file proves who built it. The published SHA-256 is what you have instead.',
      downloadAndVerify: 'Download and verify',
      readSecurityModel: 'Read the security model',
      browseComponents: 'Browse every component',
    },
  },

  /** Shared across every page that renders `<SourceRef>` / `<NotBuilt>` from
      `components/ui/Ui.tsx`. */
  ui: {
    source: 'Source',
    notBuiltBlockedByTitle: 'What has to happen first',
  },

  /** Shared by the node-and-wire diagrams (`components/graph/Graph.tsx`) on /how-it-works,
      /templates and /tutorials. */
  graph: {
    needsPermission: 'needs your permission',
    routesTo: 'routes to',
    state: {
      running: 'running',
      ok: 'ok',
      failed: 'failed',
      skipped: 'skipped',
    },
  },

  /** The permission-request mock (`components/ui/PermissionMock.tsx`). */
  permissionMock: {
    allowed: 'Allowed',
    allowFolder: 'Allow this folder',
    allow: 'Allow',
  },

  download: {
    meta: {
      description:
        'The Windows installer for Encastra {version} — size, SHA-256, and what to check before you run it. macOS and Linux are not built yet.',
    },
    hero: {
      eyebrow: 'Download',
      title: 'Get the beta',
      lead: 'One installer, for Windows, not code-signed. Nothing else exists yet — no macOS build, no Linux build, no auto-update.',
    },
    target: {
      windowsTitle: 'This looks like Windows',
      windowsBody:
        'The installer below should run here. It is still not code-signed — see the note further down before you run it.',
      otherTitle: 'This looks like {label}',
      otherBody:
        'There is no {label} build yet. The components declare support for it and the engine is written to be platform-independent, but only the Windows installer has actually been built, packaged and tested.',
      macos: 'macOS',
      linux: 'Linux',
    },
    versionMismatch: {
      title: 'This site documents {version}; the published build is {release}',
      body: 'Version {version} is the release this website is part of — it adds the site itself, onboarding, accessibility fixes and documentation. It does not change the runtime, the type system, the capability broker, the project format or the CLI, which are the same engine {release} shipped. The installer below is the real, built artefact; a {version} installer has not been produced yet.',
    },
    platforms: {
      windowsBadge: 'Windows — available',
      windowsTitle: 'Windows 10 / 11, x64',
      windowsBody:
        'NSIS installer, per user, no administrator required. This is the one artefact that actually exists.',
      noHostYet: 'No public download host yet',
      macosTitle: 'macOS',
      macosBody:
        'Components declare macOS support and the engine is written to be platform-independent, but nothing has actually been built or packaged for it.',
      linuxTitle: 'Linux',
      linuxBody: 'Same story as macOS: declared support, no build, nothing to download.',
    },
    noHostCallout: {
      part1:
        'There is no public download host for this build yet — the repository is not public and',
      part2: 'is not registered (see',
      part3:
        '). What follows is the real record of the build that exists: its exact filename, size and SHA-256, taken from',
      part4:
        ', so that whoever hosts it — or hands you a copy directly — can be checked against it.',
    },
    thisBuild: {
      eyebrow: 'This build',
      installer: 'Installer',
      size: 'Size',
      format: 'Format',
      built: 'Built',
      builtOn: '{date} on {target}',
      commit: 'Commit',
      codeSigned: 'Code-signed',
      yes: 'Yes',
      no: 'No',
      sha256Label: 'SHA-256 of {file}:',
      verifyLabel: 'Verify on Windows before you run it:',
    },
    notSigned: {
      title: 'This build is not code-signed',
      body: 'Windows SmartScreen will warn about an unrecognised publisher, and the warning is accurate — nothing in the file proves who built it. The SHA-256 above proves the file was not altered between wherever you got it and here; it proves nothing about who produced it. Both facts belong together.',
    },
    requirements: {
      eyebrow: 'System requirements',
      title: 'What it needs',
      os: 'Operating system',
      disk: 'Disk',
      network: 'Network',
      install: 'Install',
    },
    afterInstall: {
      eyebrow: 'After installing',
      title: 'What is not there yet',
      bodyPrefix:
        'Nothing updates itself — a new version means downloading a new installer and running it, once one is published somewhere. Uninstalling removes the application only; it does not touch any',
      bodySuffix: 'files, which live wherever you saved them.',
    },
  },

  security: {
    meta: {
      description:
        'What the capability broker enforces, what every first-party component asks for, what is deliberately absent, and — stated as plainly as the source document — what none of this protects against.',
    },
    hero: {
      eyebrow: 'Security',
      title: 'The capability model, stated with its limits',
      lead: 'This page does not claim the product is secure. It describes what the capability broker actually enforces, and — as plainly as the strengths — what it does not.',
    },
    reviewed: {
      title: 'Reviewed, not audited',
      body: 'Encastra has been security reviewed by the people who wrote it. It has not been externally reviewed by anyone else, and the sandbox boundary that matters most for a stranger’s code does not exist in this build yet. An external audit is a prerequisite before anything resembling a marketplace could launch.',
    },
    broker: {
      eyebrow: 'The broker',
      title: 'One gate, for every component, including the ones that ship with the product',
      lead: 'crates/encastra-core/src/broker.rs is the only code in the runtime that touches OS authority. A core component that did not declare fs.read cannot open a file, because it asks the broker and the broker refuses — there is a test that proves it. Routing trusted code through the same gate as an untrusted one means the permission dialog cannot lie about what it enforces.',
    },
    scopes: {
      inputHandles: {
        scope: 'InputHandles',
        body: 'Only what the graph wired to this node’s ports. No decision needed — it adds nothing you have not already said by drawing a line.',
      },
      directory: {
        scope: 'Directory(path)',
        body: 'One folder you chose. Nothing outside it. Symlinks are resolved, not followed out.',
      },
      httpHosts: {
        scope: 'HttpHosts(list)',
        body: 'The exact hosts you allowed. An empty list is not “all hosts” — it is no hosts.',
      },
      allowed: {
        scope: 'Allowed',
        body: 'A plain yes, for a capability with nothing to parameterise, such as showing a notification.',
      },
    },
    asksFor: {
      eyebrow: 'What each component asks for',
      title: 'No component asks for more than its job needs',
      lead: "This table is also a test: nothing_first_party_quietly_asks_for_more_than_it_needs holds the same list in code and fails the build if a component's declared capabilities change without the change being deliberate.",
      component: 'Component',
      asksForColumn: 'Asks for',
      scopeColumn: 'Scope',
      sourceNote: '§7, with the full reasoning',
    },
    absent: {
      eyebrow: 'Deliberately absent',
      title: 'These are not denied. They do not exist.',
      lead: 'Four capabilities a component might plausibly ask for, and why none of them can be granted in this build.',
      processExecution: {
        title: 'Process execution',
        body: 'There is no process.* capability anywhere in the build. The manifest validator holds an allowlist of five capability kinds and refuses any other. No consent dialog can ever be made to offer one.',
      },
      webhookListener: {
        title: 'A webhook listener',
        body: 'Receiving a request means listening on a port, which is a different security question from making one. It belongs with future trigger work, not with the HTTP client that exists today.',
      },
      videoInformation: {
        title: 'Video information',
        body: 'Reading a container’s metadata honestly needs a parser this build does not have. probe-video and probe-audio remain declared-but-unimplemented conversions rather than a component that returns guesses.',
      },
      nativePlugin: {
        title: 'A native plugin escape hatch',
        body: 'There is no path for a third party to reach the trusted, in-process tier, and none is planned. If one ever appears, the security story described on this page is gone.',
      },
    },
    limitations: {
      eyebrow: 'Known limitations',
      title: 'What the model does not do',
      lead: 'Stated plainly, because a security page that only lists controls is marketing. This is the current version of docs/SECURITY.md §9 — kept here in the same words the reference document uses.',
      sourceNote: '§9, the authoritative and current version',
      items: {
        noSandbox: {
          strong: 'The sandbox does not exist yet.',
          rest: 'Third-party components cannot execute at all. A',
          codeKind: 'kind: "wasm"',
          middle: 'node fails with',
          codeNoImpl: 'no-implementation',
          suffix: '. Everything running today is first-party and in-process.',
        },
        nothingSigned: {
          strong: 'Nothing is signed and nothing is verified.',
          rest: 'Ed25519 signing, a counter-signing registry, and a signed revocation list are specified and not implemented. There is no registry to install from.',
        },
        noCeiling: {
          strong: 'No timeout, fuel ceiling or memory ceiling on a step.',
          rest: 'Cancellation is a cooperative flag. A component that loops without checking it is not stopped.',
        },
        noDenyList: {
          strong: 'The broker has no sensitive-location deny-list.',
          rest: 'It checks that a request stays inside a folder you granted; it does not check whether that folder was somewhere it should have refused in the first place. Grant a system directory and you have granted a system directory.',
        },
        secretsUnresolved: {
          strong: 'Secrets are declared and never resolved.',
          rest: 'A workflow can mark a variable secret; nothing reads it and there is no keystore integration. A secret value cannot reach the project file — that guarantee is real and tested — but a workflow needing a token has nowhere safe to put one yet.',
        },
        grantsPerRun: {
          strong: 'Grants are per run and are not remembered.',
          rest: 'There is no record of what has been allowed before, and no distinction between “allowed once” and “allowed always”.',
        },
        bridgeTrusts: {
          strong: 'The desktop bridge trusts its own front end.',
          rest: 'That is the correct trust relationship — the WebView is first-party — but it means a scripting bug in the editor would be a grant-forging bug, not merely a defacement.',
        },
        noAudit: {
          strong: 'No external audit.',
          rest: 'This model has been reviewed by the people who built it and by the automated test suite. That is not the same thing.',
        },
        sideChannels: {
          strong: 'Side channels are out of scope.',
          rest: 'Speculative-execution and timing attacks from within a future WebAssembly guest against host memory are not defended against and are not analysed.',
        },
      },
    },
    reporting: {
      eyebrow: 'Found something',
      title: 'Reporting a vulnerability',
      lead: 'Please do not open a public issue for a security problem. A public report starts a clock that the people who can fix it may not be able to beat.',
      noAddress:
        'A published security address does not exist yet — the domain in this project’s identifiers is not registered, so any address you might infer from this site goes nowhere. Until one is published, report through the repository host’s private vulnerability reporting, or see the coordinated-disclosure draft for what to include.',
      readDisclosure: 'Read the disclosure draft',
    },
  },

  components: {
    meta: {
      description:
        'Every component in this build — {count} plus {triggers} triggers — with its real ports, configuration and capabilities, generated from the manifests the runtime parses.',
    },
    hero: {
      eyebrow: '{count} components + {triggers} triggers',
      title: 'Every component in this build',
      lead: 'Generated from crates/encastra-builtins/src/*.rs — the manifests the runtime actually parses, not a document that can drift from them. Nothing here can install a new component; there is no marketplace or registry yet, so this is the whole set.',
    },
    jumpToCategory: 'Jump to category',
    inputs: 'Inputs',
    outputs: 'Outputs',
    none: 'None.',
    configuration: 'Configuration',
    capabilities: 'Capabilities',
    declaresNothing:
      'Declares nothing. It cannot reach the filesystem, the network, the clipboard, or a notification.',
    trigger: 'Trigger',
    component: 'component',
    componentsPlural: 'components',
  },

  howItWorks: {
    meta: {
      description:
        'The six steps every Encastra workflow goes through, from picking a component to reading the journal of a finished run — shown with the same diagrams the editor uses, not screenshots.',
    },
    hero: {
      eyebrow: 'How it works',
      title: 'Six steps, every time',
      lead: 'A workflow that watches a folder and one that runs once and stops go through the same shape. Nothing below is a screenshot — every diagram is the same node-and-wire language the editor renders, built from the real component manifests.',
    },
    steps: {
      choose: {
        title: 'Choose',
        leadPrefix:
          'The palette lists every component available to you — nineteen, plus two triggers. Each states what it does in one sentence, the same sentence everywhere it appears: on the block, in the palette, and in the',
        leadLinkText: 'component catalogue',
        leadSuffix: '.',
        body: 'Components are deliberately narrow. A block that resized an image and saved it and sent a notification would be easy to use once and impossible to reuse. Kept narrow, the same Resize Image block serves a photo workflow, a thumbnail workflow, and one nobody has built yet.',
      },
      drag: {
        title: 'Drag',
        lead: 'Place a block on the canvas. Nothing about the workflow exists yet except this one step — it has no connections and will not run on its own.',
        body: 'The canvas is reachable entirely from the keyboard, not only a mouse — a block that could not be selected without one would leave its settings and its permission prompt unreachable to anyone who cannot use one.',
      },
      connect: {
        title: 'Connect',
        caption: 'examples/json-report, unconnected to a run',
        lead: 'Draw a line from an output to an input and the type system decides, on the spot, whether it fits — before the workflow exists, not when it fails halfway through a run.',
        body1:
          'Same type fits silently. A narrower type into a wider one — an image into a file — fits silently too. A wider type into a narrower one is legal but never silent: a visible conversion appears on the wire, because a claim that can be wrong needs a place to fail. Sideways — an image into a video — is refused outright; both are kinds of file, and being siblings is not a relationship that converts.',
        body2Prefix: 'The graph on the right is',
        body2Suffix:
          ', the same one quoted in the README: read a file, parse it as JSON, write it back out, then notify. Its three connections show all three kinds at once — a same-type wire, an explicit conversion, and an implicit one.',
      },
      permissions: {
        title: 'Configure permissions',
        caption:
          'What the inspector shows for Save File — reconstructed from its real manifest, not a screenshot, and not an interactive control on this page.',
        fallbackReason: 'Saves the file into the folder you pick. It cannot write anywhere else.',
        lead: 'A step that needs to reach something outside the graph — a folder, a network address, a notification — asks for exactly that, with a sentence written for the person deciding, not the name of the capability.',
        bodyPrefix: 'Declaring is not being granted. A component that asks for',
        bodySuffix:
          'still cannot write anything until a person presses the button, and the button stays disabled until a folder is actually chosen — a grant with nothing attached is an unbounded grant, and the application will not offer one.',
      },
      run: {
        title: 'Run',
        caption: 'One refusal does not discard the work that already succeeded',
        lead: 'Press run and every step’s state changes as it happens — waiting, running, finished, failed, skipped — with timing shown while it is still useful to watch.',
        bodyPrefix:
          'This is the same graph, actually run, with no folder yet allowed for Save File — the exact transcript quoted in the README.',
        bodyWriteFile: 'Write File',
        bodyMiddle: 'is refused, and',
        bodyNotify: 'Notify',
        bodySuffix:
          'is skipped because the step it depended on did not finish. The first two steps still completed; a run with one refusal is reported as partly finished, not as a crash.',
      },
      inspect: {
        title: 'Inspect',
        journal: {
          state: 'State',
          stateValue: 'failed · 0ms',
          input: 'Input',
          inputValue: 'content: text (62 characters)',
          capability: 'Capability',
          capabilityRefused: 'refused',
          reason: 'Reason',
          reasonValue: 'no folder has been allowed for this node',
        },
        lead: 'Select the failed step and the inspector shows the journal: what went in, what came out, how long it took, and every permission the broker saw — allowed or refused.',
        body: 'The journal describes values rather than quoting them — a length, a shape, a handle number — never the contents of a file. It is written to be pasted into a bug report without anyone’s data leaving with it.',
        sourceNote: 'the automated version of this checkpoint',
      },
    },
    closing: {
      lead: 'This is what the whole product does today — nothing here waits on a feature that is not built yet.',
      buildIt: 'Build the same workflow yourself',
      download: 'Download the beta',
    },
  },

  features: {
    meta: {
      description:
        'What the application does today: a real runtime, a capability broker, a typed canvas, native version history, and a CLI — everything cross-checked by tests, nothing implied that is not built.',
    },
    hero: {
      eyebrow: 'Features',
      title: 'What the application does today',
      lead: 'Every item below is either an automated test or something you can do in the palette right now. Nothing here is a roadmap item dressed up as a feature.',
    },
    built: {
      typedCanvas: {
        title: 'A typed canvas',
        body: 'Place components, connect them, and the connection is checked on the spot against one rule table both the editor and the runtime read — an illegal connection is impossible to draw, not merely discouraged.',
      },
      realRuntime: {
        title: 'A real runtime',
        body: 'Validation, topological scheduling, execution, and a journal of exactly what each step did — sequential by design, and the same engine behind the desktop app and the CLI.',
      },
      broker: {
        title: 'The capability broker',
        body: 'The only code that touches OS authority, including for components that ship with the product. A refusal is recorded with a reason; an allowance is recorded too.',
      },
      componentCount: {
        title: '{count} components + {triggers} triggers',
        body: 'Files, images, data, flow control, the network, the system clipboard and notifications. Small on purpose — see the full catalogue.',
      },
      triggers: {
        title: 'Triggers and sessions',
        body: 'Watch a folder or run on a timer, and the workflow starts itself per event rather than waiting for a person to press a button each time.',
      },
      versioning: {
        title: 'Native project versioning',
        body: 'A .encastra file is a deterministic ZIP with its own version history — create, restore, compare — with no external database.',
      },
      cli: {
        title: 'A CLI',
        body: 'The same runtime, headless, with the entire permission model expressible as flags — encastra run --allow-write step=./folder is not a simplification of the desktop app, it is the same engine.',
      },
      imageProcessing: {
        title: 'Image processing, with real limits',
        body: 'Resize, convert, thumbnail, and read metadata — with a decoder that refuses an image claiming an impossible size before it allocates anything.',
      },
    },
    notYet: {
      eyebrow: 'Not yet',
      title: 'What is designed, and what is only that',
      lead: 'Stated here rather than left for somebody to discover by clicking a dead link — the interface should never promise something that does not exist.',
    },
    sandbox: {
      title: 'Third-party components, in a WebAssembly sandbox',
      blockedBy: {
        item1: 'A host crate that loads a WIT-defined component with no ambient authority',
        item2: 'Per-node timeouts, fuel metering and a memory ceiling',
        item3: 'Signing and a revocation list, so an installed component can be verified',
      },
      bodyPrefix:
        'The design is written down — see /security — and none of it runs. Every component in this build is first-party and in-process; a manifest declaring',
      bodySuffix: 'fails immediately with',
    },
    registry: {
      title: 'A registry, a marketplace, and installing a new component',
      blockedBy: {
        item1: 'The Wasm sandbox above',
        item2: 'A backend: auth, users, projects',
        item3: 'A publishing and review path',
      },
      bodyPrefix: 'Nothing you use today came from anywhere but the box it shipped in. See',
      bodyMiddle: 'and',
      bodySuffix: 'for what those pages say about themselves.',
    },
    cta: 'See every component in detail',
  },

  templates: {
    meta: {
      description:
        'The three workflows that ship with the application — Image Processor, File Organiser and Thumbnails. Ordinary graphs, run on the same runtime as anything you build, with their folders deliberately left empty.',
    },
    hero: {
      eyebrow: 'Templates',
      title: 'Workflows that ship with the app',
      lead: 'Three demos, and they double as end-to-end test fixtures — not screenshots. Each one arrives with its folders deliberately empty, the same reason a workflow you send somebody else arrives with no permissions granted.',
    },
    imageProcessor: {
      summaryPrefix:
        'Watches a folder. Whenever an image appears, it makes a smaller copy in another folder — the same checkpoint quoted in the README, and the workflow',
      tutorialLinkText: 'the tutorial',
      summarySuffix: 'builds from scratch.',
      needsWatch: 'A folder to watch',
      needsSave: 'A folder to save into',
    },
    fileOrganiser: {
      summary:
        'Watches a folder and moves what lands in it into one of three others, by file type. The extension decides the route; the file itself is what travels along it.',
      needsWatch: 'A folder to watch',
      needsImages: 'A folder for images',
      needsDocuments: 'A folder for documents',
      caption: 'A third route, for anything else, is wired but not shown here',
    },
    thumbnails: {
      summary:
        'Turns a folder of images into square previews, ready for a gallery or a grid. Unlike Image Processor, this one processes files already sitting in the folder when it starts.',
      needsWatch: 'A folder to watch',
      needsSave: 'A folder to save into',
    },
    rule: {
      eyebrow: 'One rule',
      title: 'Every template is an ordinary graph',
      lead: 'Nothing about these three is privileged. They run through the same validation, the same capability broker, and the same runtime as a workflow you build from an empty canvas — which is also why they make honest test fixtures rather than curated screenshots.',
    },
  },

  docs: {
    meta: {
      description:
        'What is written down, and who it is written for. The repository is not public yet, so this page describes each document rather than hosting it.',
    },
    hero: {
      eyebrow: 'Documentation',
      title: 'What is written down',
      lead: 'The reference material lives in the repository as docs/*.md, next to the code it describes. The repository is not public, so this page says what each document is and who it was written for, rather than hosting or linking to it.',
    },
    forAnyone: { eyebrow: 'For anyone', title: 'Written for somebody who is not an engineer' },
    forEngineers: { eyebrow: 'For engineers', title: 'Reference material' },
    audience: {
      engineers: 'engineers',
      everyone: 'everyone',
    },
    items: {
      architecture: {
        title: 'Architecture',
        summary: 'How the system is built and why, including what is designed and not yet built.',
      },
      security: {
        title: 'Security',
        summary:
          'The implementation report: what each control enforces, and §9, what it does not. Not a claim that the product is secure.',
      },
      threatModel: {
        title: 'Threat model',
        summary: 'Assets, trust boundaries, STRIDE per boundary, and what is knowingly undefended.',
      },
      runtime: {
        title: 'Runtime',
        summary: 'Validation, scheduling, execution, the journal, and conversions on edges.',
      },
      componentSdk: {
        title: 'Component SDK',
        summary:
          'The contract a third-party component would implement. Documents the contract, not a working path — the host does not exist yet.',
      },
      projectFormat: {
        title: 'Project format',
        summary: 'What a .encastra file contains and the guarantees it makes.',
      },
      release: {
        title: 'Release',
        summary: 'How a build is produced, what it contains, and what you can check about it.',
      },
      testing: {
        title: 'Testing',
        summary: 'What is tested, how, and which tests are the load-bearing ones.',
      },
      productRoadmap: {
        title: 'Product roadmap',
        summary: 'What ships when, and a named list of what would make this fail.',
      },
      adr: {
        title: 'Decision records',
        summary: 'The decisions, with the alternatives that lost.',
      },
    },
    closing: {
      lead: 'The tutorial itself is written out in full, not just described — it is the one place this site does host the actual content rather than pointing at it.',
      cta: 'Read the tutorial',
    },
  },

  tutorials: {
    meta: {
      title: 'Build your first workflow',
      description:
        'The one tutorial written out in full: watch a folder, resize what lands in it, save a smaller copy somewhere else. The same three blocks the project uses as its own proof that everything works.',
    },
    hero: {
      eyebrow: 'Learn',
      title: 'Build your first workflow',
      lead: 'A workflow that sits and watches a folder. Every time you drop a photo into it, a smaller copy appears in a different folder, automatically. This is the same three blocks the project uses as its own proof that everything works — there is an automated test that puts a real 800×400 PNG in and checks a real 200×100 PNG comes out, and if it fails the product is considered broken.',
      time: 'Time',
      timeValue: 'About ten minutes, most of it reading',
      needs: 'Needs',
      needsValue: 'Encastra installed, and one image file to test with',
    },
    beforeStart: {
      eyebrow: 'Before you start',
      title: 'Make two folders',
      body: 'Two separate folders, not one. If the workflow wrote its results back into the folder it was watching, the watcher would notice the result and process it again, and the result of that again. Keeping them apart avoids the whole class of problem.',
      inbox: { name: 'inbox', body: 'The folder you will drop photos into.' },
      out: { name: 'out', body: 'The folder the smaller copies will appear in.' },
    },
    settingsTable: {
      setting: 'Setting',
      notes: 'Notes',
      required: '(required)',
    },
    steps: {
      1: {
        title: 'An empty canvas',
        visualPrefix: 'Open Encastra. From',
        home: 'Home',
        visualMiddle1: ', start a new workflow. You land in',
        builder: 'Builder',
        visualMiddle2: ', looking at three areas: the',
        palette: 'palette',
        visualMiddle3: 'on one side, listing every block available to you; the',
        canvas: 'canvas',
        visualMiddle4: 'in the middle, currently empty; and the',
        inspector: 'inspector',
        visualSuffix: 'on the other side, which fills in when you select a block.',
        lead: 'Nothing is on the canvas yet. That is the whole of this step.',
      },
      2: {
        title: 'Add Watch Folder',
        leadPrefix: 'Find',
        watchFolder: 'Watch Folder',
        leadSuffix:
          'in the palette and put it on the canvas, towards the left. It notices when a file appears in a folder and starts the workflow.',
        bodyPrefix: 'It is a',
        trigger: 'trigger',
        bodySuffix:
          ', which is a different kind of block from the rest: it has no inputs, because nothing feeds it — it is the thing that begins. It gives out three outputs; you only need',
        bodyEnd: 'for this workflow.',
      },
      3: {
        title: 'Add Resize Image',
        leadPrefix: 'Put',
        resizeImage: 'Resize Image',
        leadSuffix:
          'on the canvas to the right of the watcher. It changes an image’s size, and nothing else — it does not save anything, and Step 5 explains why that matters.',
      },
      4: {
        title: 'The first connection, and what it means',
        caption: 'watch.file → resize.image — legal, and not silent',
        leadPrefix: 'Drag from the watcher’s',
        leadMiddle: 'output to the resizer’s',
        leadSuffix:
          'input. A connection says: when this step produces its result, hand it to that one — and it decides the order, because you never schedule anything.',
        body1Prefix: 'The watcher’s',
        body1Middle: 'port is typed File; the resizer’s',
        body1Suffix:
          'port is typed Image. Those are not the same type, and Image is the narrower of the two — every image is a file, but not every file is an image. Connecting a File to an Image is a claim that this file really is one, and that claim can be wrong. So the connection is allowed, but it is not silent:',
        body1End:
          'appears on the wire, a conversion where a file that turns out to be a text document has somewhere visible to fail.',
        body2Prefix: 'What travels along the line is not a path. The resizer receives a',
        handle: 'handle',
        body2Suffix:
          '— an opaque ticket meaning “the file you were given” — and can look at nothing else, which is why the permission question in Step 6 is narrow enough to be worth answering.',
      },
      5: {
        title: 'Add Save File',
        caption: 'watch.file → resize.image → save.file',
        leadPrefix: 'Put',
        saveFile: 'Save File',
        leadMiddle: 'to the right of the resizer, and connect the resizer’s',
        leadEnd: 'output to Save File’s',
        leadSuffix:
          'input. That connection needs no conversion — an Image going into a File input is a',
        widening: 'widening',
        leadFinal: ', which can never fail.',
        bodyPrefix:
          'Why does the resizer not just save its own result? The resizer writes into scratch space belonging to the run, which is not anywhere you can see and needs no permission from you. Putting a file somewhere you',
        can: 'can',
        bodySuffix:
          'see is a different act, and it is the act that has to ask — so Save File is the one block that does, and you always know which step touches your disk.',
      },
      6: {
        title: 'Permissions, and why you are being asked',
        watchReason: 'Watches the folder you pick and reads the files that appear in it.',
        saveReason: 'Saves the file into the folder you pick. It cannot write anywhere else.',
        leadPrefix: 'Select Watch Folder again and look at the inspector: below its settings is a',
        permissionsSection: 'Permissions',
        leadMiddle: 'section. Select Save File and you find its own. Press',
        allowThisFolder: 'Allow this folder',
        leadSuffix: 'on both.',
        body1:
          'What you just agreed to is not “this workflow may read and write files”. You agreed that this watcher may read inside that one folder, and that this Save File block may write inside that other one folder — nothing outside it, and a second Save File block would be a second, separate decision.',
        body2Prefix: 'Notice what Resize Image is',
        not: 'not',
        body2Suffix:
          'asking for: nothing. It only ever sees what the workflow handed it, which is not a decision, because you already said so by drawing the line.',
        callout:
          'These last one run. They are not saved into the file and not remembered between runs — if you send this workflow to somebody, it arrives able to do nothing until they answer for themselves.',
      },
      7: {
        title: 'Run it',
        visual1Prefix: 'Notice the button does not say',
        run: 'Run',
        visual1Middle: '. It says',
        startWatching: 'Start watching',
        visual1Suffix:
          ', because this workflow begins with a trigger: it waits, rather than doing a thing once and stopping. A dot in the toolbar and a counter in the status bar tell you it is live.',
        visual2Prefix: 'Drop a photo into',
        visual2Suffix:
          '. Within a second or so the three blocks light up in turn, a smaller copy appears in',
        visual2End:
          ', and the status bar counts one run. Each file is its own run — drop three more in and watch it happen three more times.',
        leadPrefix: 'Press',
        ctrl: 'Ctrl',
        leadMiddle: '+',
        enter: 'Enter',
        leadSuffix: ', or the button in the toolbar.',
        body: 'There is a short pause before anything happens on purpose: the watcher checks the folder about twice a second, then waits until the file has stopped changing size before handing it on. A large photo copied from a network drive keeps growing for a few seconds after it appears, and handing that to the resizer would fail in a way that looks like your workflow’s fault.',
      },
      8: {
        title: 'Look at what happened',
        cardTitle: 'Resize Image',
        cardLine1: 'finished · 38ms',
        cardLine2: 'image: 800×400 in → image: 200×100 out',
        cardLine3: 'fs.read — allowed (input-handles)',
        leadPrefix: 'After it stops, the inspector shows the',
        journal: 'journal',
        leadSuffix:
          '— the record of the run. Select the resizer and you see what state it ended in, how long it took, and every permission request the gate saw, allowed or refused.',
        body: 'The journal describes values rather than quoting them — never the contents of your photographs. Nothing is written to disk in this build; close the application and this record is gone.',
      },
      9: {
        title: 'Save it',
        visualPrefix: 'You get a single',
        visualSuffix:
          'file holding the graph, the settings on each block, and a version history you can look back through and restore from. It does not hold your permissions, and it cannot hold a secret — the place that would store one does not exist in the format.',
        lead: 'One file. You can email it, put it in a repository, or rename it — nothing about it depends on the machine that wrote it.',
      },
    },
    refusal: {
      eyebrow: 'When it refuses to run',
      title: 'This is the system working',
      body1:
        'If you run before granting a permission, or change a folder afterwards so the grant no longer matches:',
      transcript:
        'denied: This component tried to use fs.write and was not allowed: no folder has\nbeen allowed for this node.\nGrant this component access to a folder, then run again.',
      body2:
        'Select the step, check the Permissions section, press the button again. The rest of the workflow still ran — steps that depended on the refused one are marked skipped, with the reason.',
    },
    tryBreaking: {
      eyebrow: 'Try breaking it',
      title: 'What to change next',
      swapResizer: {
        title: 'Swap the resizer',
        body: 'Replace Resize Image with Thumbnail to get square previews instead of a scaled copy.',
      },
      addNotification: {
        title: 'Add a notification',
        body: 'Put Notify after Save File. It needs its own permission — a plain Allow, since there is nothing to narrow about a notification.',
      },
      forceFormat: {
        title: 'Force a format',
        body: 'Put Convert Image between the resizer and Save File to write everything as WebP.',
      },
      removePermission: {
        title: 'Take a permission away',
        body: 'Run it again with a folder ungranted, just to watch it refuse properly.',
      },
    },
    closing: {
      lead: 'Two demo workflows ship alongside the one you just built: File Organiser and Thumbnails, both with their folders deliberately left empty.',
      templates: 'See the shipped templates',
      download: 'Download the beta',
    },
  },

  pricing: {
    meta: {
      description:
        'What it costs today: nothing. There are no paid plans, no accounts, and no payment system in this build.',
    },
    hero: {
      eyebrow: 'Pricing',
      title: 'What it costs today',
      lead: 'Nothing. There is no payment system, no account, and no plan to choose between — so there is one real price on this page and a stated absence rather than a pricing table with invented numbers on it.',
    },
    free: {
      badge: 'Free — beta',
      title: 'Download and run it',
      body: 'The Windows installer costs nothing and needs no account. Everything documented on this site — the runtime, the capability broker, all nineteen components — is available in the beta today, with the limitations stated on /security.',
      cta: 'Download the beta',
    },
    notYet: {
      eyebrow: 'Not yet',
      title: 'What would eventually cost money',
      lead: 'Real payments are explicitly out of scope for the current milestone, and the roadmap places them after a marketplace listing model exists — a listing is not the same as money moving through it.',
    },
    payments: {
      title: 'No paid plans, no marketplace purchases, no subscriptions',
      blockedBy: {
        item1: 'A backend with accounts and billing',
        item2: 'A marketplace listing model (built without payments first)',
        item3: 'Real payments, kept sandboxed until that is deliberately turned off',
      },
      body: 'When any of this exists, it will replace this page’s claim of “nothing to pay” with real numbers — not the other way around.',
    },
  },

  about: {
    meta: {
      description:
        'What Encastra is, where the name comes from, its unresolved legal status, and where the project actually stands today.',
    },
    hero: {
      eyebrow: 'About',
      title: 'What this is, and where it stands',
      lead: 'Encastra is a local-first runtime that executes a typed graph of components, plus the editor, protocol and CLI built around it. This page is the honest version of that sentence — what exists, what is a working name, and what is still only a design document.',
    },
    checkpoint: {
      title: 'The checkpoint the product is measured against',
      lead: 'Not a slide. A test in the repository, run on every change:',
      body: 'Watch a folder. Drop an 800×400 PNG into it. A 200×100 copy appears in another folder, and nothing was written anywhere that was not explicitly allowed.',
      bodyPrefix: 'That is',
      tutorialLinkText: 'the tutorial',
      bodySuffix: 'builds by hand and the terminal on the homepage replays.',
      bodyMiddle: ', and it is also the workflow',
    },
    name: {
      eyebrow: 'The name',
      title: 'Encastra is a working name',
      body1Prefix: 'Encastrar',
      body1Middle: 'is a real Spanish verb, from Latin',
      body1LatinWord: 'incastrare',
      body1Suffix:
        ': to interlock or couple two pieces so that each holds the other — the product, stated in one word. It was chosen from a researched shortlist: the npm scope, the GitHub org and the',
      body1Dev: '.dev',
      body1End:
        'domain all appear unregistered, and no product or company by this name surfaced in a search of any industry.',
      body2Strong: 'What was not checked, and matters: trademark registers.',
      body2Prefix:
        'USPTO, EUIPO and TMview have not been searched. An available npm handle is not trademark clearance, and nobody associated with this project states that the name is legally clear — see',
      body2LinkText: 'the trademark notice',
      body2Suffix: 'for the full, equally honest version of this paragraph.',
      body3:
        'The product was originally developed under a different working name that referenced a well-known interlocking-brick toy. That name created real trademark risk and has been permanently retired from every public surface — it does not appear on this site, in the repository, or in any package name, and it will not reappear.',
      calloutTitle: 'Until clearance happens',
      calloutBody:
        'The name is treated as reversible. It appears in exactly three shapes across the codebase — the npm scope, the crate prefix, and the project file extension — specifically so a rename, if one is ever needed, is one scripted commit rather than a migration.',
    },
    nonGoals: {
      eyebrow: 'Non-goals',
      title: 'What this is deliberately not',
      noAiStrong: 'No AI in the runtime.',
      noAiBody:
        'Workflows execute without a model in the loop, by design — no component, no scheduling decision, and no validation path calls one. An authoring aid that suggests a component or explains an error is a possible future addition, strictly outside the execution path; it is not a plan to make the runtime itself probabilistic.',
      noFinishedStrong: 'No claim of being finished.',
      noFinishedBody:
        'The runtime, the type system, the capability broker and the project format are built and tested. The website you are reading, the onboarding flow, and accessibility fixes are what the current release adds on top of that — see /download for exactly which build is which.',
    },
    stands: {
      eyebrow: 'Where it stands',
      title: 'Beta, and the word is meant',
      engine: {
        title: 'The engine',
        body: 'Runtime, type system, capability broker, project format, CLI: built, tested, and cross-checked between the TypeScript and Rust readers of the same rule table.',
      },
      desktop: {
        title: 'The desktop application',
        body: 'A canvas, a palette, an inspector that doubles as a debugger, and native version history. Windows-tested; components declare macOS and Linux support the engine does not yet ship a build for.',
      },
      website: {
        title: 'This website',
        bodyPrefix:
          'New. Its whole purpose is to make the above legible to somebody who has not read the source — see docs/BETA-0.2-AUDIT.md’s own account of why it did not exist before.',
      },
      everythingElse: {
        title: 'Everything else',
        body: 'Third-party components, a registry, a marketplace, accounts and payments are designed and not built. /security and /marketplace say so specifically, not just here.',
      },
    },
    closing: {
      lead: 'Build {commit} is the one this site’s download page documents.',
      cta: 'See the real build record',
    },
  },

  community: {
    meta: {
      description:
        'Not built yet. There is no community feature in this build — no accounts, no profiles, no forum.',
    },
    hero: { eyebrow: 'Community', title: 'Not built yet' },
    notBuilt: {
      title: 'No accounts, no profiles, no forum',
      blockedBy: {
        item1: 'A backend: authentication, users, projects',
        item2: 'A component registry to publish to',
        item3: 'A marketplace listing model',
      },
      body1:
        'There is nowhere on this site or in the application to sign in, follow another author, or post anything. This page is here so the sidebar and the site map are honest about what does not exist, rather than pointing at an empty screen.',
      body2Prefix:
        'The product roadmap places Community after the backend and the component registry — see',
      body2LinkText: '/about',
      body2Suffix: 'for the project’s current stage.',
    },
    cta: 'Download the beta instead',
  },

  contact: {
    meta: {
      description:
        'How to reach the project today. There is no public email yet, no accounts, and no support desk — this page says exactly what does and does not exist.',
    },
    hero: {
      eyebrow: 'Contact',
      title: 'How to reach the project',
      lead: 'Honestly: there is not much here yet. No account, no support desk, and no published general-purpose address — because none of those exist. This page names the one channel that does.',
    },
    noAddress: {
      title: 'No general contact address yet',
      bodyPrefix: 'The domain in this project’s own identifiers,',
      bodyMiddle: 'is not registered (see',
      bodySuffix:
        '), so an address anybody might guess from this site would go nowhere. Establishing one is a launch prerequisite, not something skipped by accident.',
    },
    security: {
      eyebrow: 'Security',
      title: 'Found a vulnerability?',
      body: 'This is the one channel that is specified today. Please do not open a public issue — report privately through the repository host’s private vulnerability reporting. See the disclosure draft for exactly what to include and what to expect.',
      cta: 'Read the disclosure policy',
    },
    everythingElse: {
      eyebrow: 'Everything else',
      title: 'Bugs, questions, and feedback',
      body: 'There is no support desk and no dedicated feedback channel yet. If you have found this site, you most likely also have access to the repository it describes — the commit history and its issue tracker, where they exist, are the closest thing to a contact channel this project currently has.',
    },
  },

  marketplace: {
    meta: {
      description:
        'Not built yet. There is no way to install a component beyond the nineteen that ship with the app.',
    },
    hero: { eyebrow: 'Marketplace', title: 'Not built yet' },
    notBuilt: {
      title: 'You cannot install a component',
      blockedBy: {
        item1: 'The WebAssembly sandbox third-party components would run in',
        item2: 'Signing and a revocation list, so an installed component can be verified',
        item3: 'A registry: publish, verify, install, revoke',
        item4: 'A listing model — money movement is explicitly out of scope even after that',
      },
      body1Prefix:
        'Every component you can use is in the box — nineteen, plus two triggers, all first-party and compiled into the application. See',
      body1LinkText: 'the full catalogue',
      body1Suffix: 'for exactly what that set can do.',
      body2:
        'When this exists, listings will come before any money moves through it — the roadmap treats a marketplace listing model and real payments as separate milestones, in that order.',
    },
    cta: 'See what you actually have today',
  },

  legal: {
    index: {
      meta: {
        description:
          'The nine legal documents this project has drafted. All nine are drafts pending review by qualified legal counsel and are not legal advice.',
      },
      hero: {
        eyebrow: 'Legal',
        title: 'All documents',
        lead: 'Every document below is a draft. None has been reviewed by a lawyer, and every page says so again before the text itself.',
      },
      calloutTitle: 'Not legal advice',
      calloutBody:
        'These are working drafts written to state, honestly, what this project currently intends to promise — not finished policies. Nothing on this page or the pages it links to should be relied upon as legal advice, and nothing here has been reviewed by qualified legal counsel.',
    },
    doc: {
      eyebrow: 'Legal · Draft',
      metaDescription: 'Draft — {summary}',
      calloutTitle: 'Draft — not legal advice',
      calloutBodyPrefix:
        'This document has not been reviewed by qualified legal counsel and is not a finished policy. It states, honestly, what the project currently intends to promise. See',
      calloutLinkText: 'all documents',
      calloutBodySuffix: 'for the same notice on every one of them.',
    },
  },
};

export default en;
