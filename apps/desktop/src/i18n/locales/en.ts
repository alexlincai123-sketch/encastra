/**
 * English. The source of truth: every key used anywhere in the interface exists here first, and
 * every other locale file is checked against this one.
 */

import type { Messages } from '../index';

const en: Messages = {
  common: {
    close: 'Close',
    dismiss: 'Dismiss',
    // Reused wherever a control opens a file or folder picker, so a change to this one word
    // does not have to be hunted down across every screen that has a "Choose…" button.
    choose: 'Choose…',
    // The heading over a list of what a component or workflow is refused, everywhere that list
    // appears — the catalogue card, the inspector's permission panel.
    itCannot: 'It cannot',
    // The word on the small badge marking a journal as a recording rather than a live result —
    // the status bar and the run panel both show it, and it must read the same in both places.
    recordingBadge: 'recording',
  },

  sidebar: {
    ariaLabel: 'Sections',
    running: ', running',
    items: {
      home: 'Home',
      builder: 'Builder',
      components: 'Components',
      security: 'Security',
      settings: 'Settings',
    },
  },

  home: {
    intro: {
      heading: 'Build software from parts that fit.',
      body: 'Put components on a canvas, connect them, and press start. Everything runs on this machine, and nothing reaches your files without being asked.',
    },
    actions: {
      new: {
        title: 'New workflow',
        detail: 'Start from an empty canvas',
      },
      open: {
        title: 'Open',
        detailReady: 'A .encastra file you saved earlier',
        detailUnavailable: 'Needs the desktop application',
      },
      browse: {
        title: 'Browse components',
        detail: {
          one: '{count} installed, and what it can reach',
          other: '{count} installed, and what each one can reach',
        },
      },
    },
    continue: {
      heading: 'Where you left off',
      steps: {
        one: '{count} step',
        other: '{count} steps',
      },
      unsaved: ' · not saved yet',
    },
    samples: {
      heading: 'Samples',
      note: 'Real workflows on the real runtime. Each one needs you to choose its folders before it can start — a sample that wrote somewhere you had not picked would be the opposite of the point.',
      needs: 'Needs: {list}',
    },
  },

  palette: {
    title: 'Components',
    empty: 'No components are installed.',
    asksTo: 'Asks to: {list}',
    capabilities: {
      fsRead: 'reads files',
      fsWrite: 'writes files',
      netHttp: 'uses the network',
      systemNotify: 'shows notifications',
      systemClipboard: 'uses the clipboard',
    },
  },

  canvas: {
    ariaLabel: 'Workflow canvas',
    refusal: {
      selfCycle: {
        headline: 'A step cannot feed itself.',
        detail:
          'A workflow runs forwards. To do the same work repeatedly, start it from a trigger — Watch Folder or Timer — which runs it once per event.',
      },
      bridge: 'A step producing {bridge} in between would join them.',
    },
    empty: {
      heading: 'Your canvas is empty',
      body: 'A workflow is a few components joined together. Pick one from the left to place your first step, connect its output to the next, and press Run.',
      hint: 'Every component says what it can reach before it runs, and nothing touches your files until you allow it.',
    },
    keysHint:
      'Use the arrow keys to move between steps, Enter to open a step in the inspector, Escape to deselect, and Delete to remove the selected step.',
    a11y: {
      selected: '{name}, step {index} of {total}, selected.',
    },
    node: {
      /** Shown on a node whose `componentRef` this build has no manifest for — the graph
       * references something that is not part of it. */
      notInstalled: 'Not installed.',
    },
    // The badge a wire shows when the type system inserted a conversion on it. Keyed by the
    // runtime's own operation id (`Wire.tsx`'s `OP_LABELS`), not by the English phrase, so a
    // locale can phrase the same operation differently without touching the lookup.
    wire: {
      ops: {
        toText: 'as text',
        intToFloat: 'as decimal',
        boolToInt: 'as number',
        intToBool: 'as yes/no',
        round: 'rounded',
        parseInt: 'parse number',
        parseFloat: 'parse decimal',
        parseBool: 'parse yes/no',
        parseJson: 'parse JSON',
        stringifyJson: 'as text',
        encodeJson: 'to JSON',
        decodeJson: 'from JSON',
        readBytes: 'read',
        writeTemp: 'to file',
        unwrapOption: 'may be absent',
        map: 'each',
      },
    },
  },

  toolbar: {
    preview: {
      badge: 'preview',
      title: 'No runtime is attached to this window.',
    },
    new: 'New',
    open: 'Open',
    save: 'Save',
    unsavedChanges: 'Unsaved changes',
    check: 'Check',
    stop: 'Stop',
    run: 'Run',
    startWatching: 'Start watching',
    watching: 'Watching',
    // The two journals bundled with the browser preview, offered as buttons in place of Check
    // and Run when there is no real runtime to press them against.
    recordedRuns: {
      everythingAllowed: 'Recorded: everything allowed',
      folderNotAllowed: 'Recorded: the folder was not allowed',
    },
    notifications: {
      more: '{count} more',
    },
    status: {
      steps: {
        one: '{count} step',
        other: '{count} steps',
      },
      running: 'running',
      runs: {
        one: '{count} run',
        other: '{count} runs',
      },
      waiting: '{count} waiting',
      // The count and the word were two separately-concatenated fragments before — exactly the
      // thing `i18n/index.ts` warns a translation can never safely do — so each is now one
      // template with `{count}` inside it, even though English itself does not inflect any of
      // the three.
      ok: {
        one: '{count} ok',
        other: '{count} ok',
      },
      failed: {
        one: '{count} failed',
        other: '{count} failed',
      },
      skipped: {
        one: '{count} skipped',
        other: '{count} skipped',
      },
    },
  },

  // The component library (`views/Components.tsx`) — not to be confused with
  // `settings.components`, the Settings category that lists the same build in summary.
  components: {
    header: {
      title: 'Components',
      summary: '{count} installed.',
      summaryWithTriggers:
        '{count} installed — {triggerCount} of them start a workflow on their own; the rest run as a step inside one.',
      note: 'Everything here ships with the application; installing others needs the sandbox for third-party code, which is not built yet.',
    },
    search: {
      placeholder: 'Search',
      ariaLabel: 'Search components',
    },
    filters: {
      categoryLegend: 'Category',
    },
    empty: 'Nothing matches that.',
    card: {
      triggerBadge: 'starts a workflow',
      triggerNote:
        'A source of events, not a step — this begins a run instead of running inside one.',
      noDescription: 'This component has not documented what it does.',
      takes: 'Takes',
      gives: 'Gives',
      addToCanvas: 'Add to canvas',
    },
    reach: {
      label: 'Can reach',
      none: 'Reaches nothing outside this workflow',
      // Capitalised, third-person: "Reads files". `panels/Inspector.tsx` reuses the `cannot`
      // half of this map for its own permission panel — the two screens describe the same
      // capabilities and must not drift into describing them differently.
      verb: {
        fsRead: 'Reads files',
        fsWrite: 'Writes files',
        netHttp: 'Uses the network',
        systemClipboard: 'Uses the clipboard',
        systemNotify: 'Shows notifications',
      },
      cannot: {
        fsRead: 'read your files',
        fsWrite: 'write files',
        netHttp: 'use the network',
        systemClipboard: 'use the clipboard',
        systemNotify: 'show notifications',
      },
    },
  },

  security: {
    title: 'Security',
    intro:
      'Components cannot reach your files, your network or your clipboard unless a manifest declares it and you allow it. Permissions are granted per run, and every request — allowed or refused — is recorded where you can read it.',
    installed: {
      title: 'Installed components',
      headers: {
        component: 'Component',
        version: 'Version',
        origin: 'Origin',
        canReach: 'Can reach',
      },
      builtIn: 'built in',
      nothing: 'nothing',
      // `{notBuilt}` is rendered in its own `<strong>`, split out with `splitOnPlaceholder` the
      // same way `canvas.refusal.bridge` splits around `{bridge}` — see `i18n/index.ts`.
      thirdPartyNote:
        'Nothing here came from outside this application. Third-party components would run in a WebAssembly sandbox with no ambient authority; that sandbox is designed and documented but {notBuilt}, so installing them is not possible yet.',
      thirdPartyNoteEmphasis: 'not built',
    },
    grants: {
      title: 'Allowed in the open workflow',
      empty: 'Nothing has been allowed. A workflow that needs a folder will ask before it runs.',
      note: 'These last for this session. Closing the application forgets them, so a workflow you have not looked at in a month cannot still be writing somewhere.',
    },
    privacy: {
      title: 'Privacy',
      telemetry: { label: 'Telemetry', value: 'None. Nothing is collected and nothing is sent.' },
      crashReports: { label: 'Crash reports', value: 'None.' },
      accounts: { label: 'Accounts', value: 'None. There is no sign-in and no server.' },
      yourFiles: {
        label: 'Your files',
        value: 'Never leave this machine unless a workflow you built sends them somewhere.',
      },
      // The label reuses `settings.privacy.yourData.runJournals.label` — the Settings screen
      // already translates this exact word, and this screen means the same thing by it.
      runJournals: {
        value:
          'Record sizes and shapes, never file contents. A journal is held in memory for as long as the window is open and shown on screen; nothing writes one to disk, and closing the application discards it.',
      },
    },
    limits: {
      title: 'What this does not protect against',
      misuse:
        'A component you allow broad access to can misuse it. The dialog can make that informed; it cannot make it impossible.',
      trustedBase:
        'Built-in components run as ordinary native code. They are constrained by the permission broker, but a bug in one is a bug in the trusted base.',
      noAudit:
        'This build has had no external security audit. That is a prerequisite for distributing components written by other people, not for running your own workflows.',
      unsigned: 'Nothing here is signed yet, so this build cannot prove it has not been altered.',
      previewOnly: 'This is a browser preview with no runtime attached.',
    },
    footer: 'Runtime {runtime} · protocol schema {protocolSchema} · project schema {projectSchema}',
  },

  inspector: {
    problemsTitle: 'Problems',
    projectTitle: 'Project',
    selectStep: 'Select a step to configure it, or pick a component to begin.',
    component: 'Component',
    switchOn: 'Switch on',
    switchOff: 'Switch off',
    settingsTitle: 'Settings',
    nothingChosen: 'Nothing chosen',
    entryInputs: {
      title: 'Starting material',
      doc: 'Nothing in the graph produces this, so the run needs it from you.',
    },
    permissions: {
      title: 'Permissions',
      none: 'This component asks for nothing. It works only on what the graph hands it, and it cannot reach your files, the network or the clipboard.',
      allowed: 'Allowed',
      allowFolder: 'Allow this folder',
      allowHost: 'Allow {host}',
      allowAddress: 'Allow this address',
      allow: 'Allow',
      chooseFolderFirst: 'Choose a folder first.',
      enterAddressFirst: 'Enter an address first.',
      notASetting:
        'Not a setting — the component never declared these, so the runtime refuses them whatever you allow here.',
      // Reuses `components.reach.cannot` — the same capability, described the same way whether
      // it is read from the catalogue or from a node actually placed on the canvas.
    },
    versions: {
      title: 'Versions',
      titleWithCount: 'Versions · {count}',
      empty:
        'Save this project to start keeping versions. Every save records one, and nothing is ever overwritten.',
      currentVersionTitle: 'This is the current version.',
      restoreTitle: 'Restore this. It is added as a new version; nothing is lost.',
      current: 'Current',
      versionNumber: 'Version {number}',
      restore: 'Restore',
    },
    runRecord: {
      title: 'Last run',
      code: 'Code: {code}',
      neverRan: 'This step never ran, because {name} did not finish.',
      status: 'Status',
      took: 'Took',
      in: 'in {port}',
      out: 'out {port}',
      permissionsUsed: 'Permissions used',
      refused: ' · {count} refused',
      logs: 'Logs',
    },
  },

  // The execution panel (`panels/RunPanel.tsx`). Its pure formatting functions call `translate`
  // directly rather than taking a `t` — see the file itself — precisely so `store.ts`'s own
  // status-bar summary can share these same keys instead of describing the same run differently.
  runPanel: {
    ariaLabel: 'Run',
    title: 'Run',
    recordingTitle:
      'This is a recorded run, played back for the debugger. It did not just happen on this machine.',
    empty:
      'Nothing has run yet. Press Run above and each step will appear here, in the order the runtime executes them, with its status and how long it took — or, if one fails, what went wrong and what to do about it.',
    status: {
      pending: 'Waiting',
      running: 'Running',
      ok: 'Finished',
      failed: 'Failed',
      skipped: 'Skipped',
      cancelled: 'Cancelled',
      disabled: 'Switched off',
    },
    outcome: {
      watching: 'Watching for changes…',
      running: 'Running…',
      finished: 'Finished.',
      finishedIn: 'Finished in {took}.',
      partial: {
        one: '{count} step failed. The rest of the graph still ran.',
        other: '{count} steps failed. The rest of the graph still ran.',
      },
      failed: 'Nothing completed.',
      cancelled: 'Stopped.',
    },
    watch: {
      runsSoFar: {
        one: '{count} run so far',
        other: '{count} runs so far',
      },
      pendingWaiting: '{count} waiting',
    },
    step: {
      neverRan: 'Never ran — {name} did not finish.',
    },
  },

  // The guided first workflow (`onboarding/`). `steps.ts` stores a `titleKey`/`bodyKey` pair per
  // card rather than the English prose itself — see the file — so `onboarding.test.ts` and
  // `Welcome.tsx` both go through `translate()` for the words a person actually reads.
  onboarding: {
    tour: {
      stepCount: 'Step {current} of {total}',
      done: 'Done — carry on when you are ready.',
      waiting: 'Waiting for you to try it.',
      finish: 'Finish',
      next: 'Next',
      canvas: {
        title: 'This is your canvas',
        body: 'A workflow is a few components joined together. Everything runs on this machine, and nothing reaches your files until you allow it.',
      },
      addFirst: {
        title: 'Add the first step',
        body: 'On the left is every component installed. Find Watch Folder and add it — it starts the workflow whenever a file appears somewhere you choose.',
      },
      addSecond: {
        title: 'Add something to do',
        body: 'Now add Resize Image. It takes a picture and makes a smaller copy, leaving the original alone.',
      },
      connect: {
        title: 'Join them together',
        body: 'Drag from the file port on Watch Folder to the image port on Resize Image. A file is not yet a picture, so the editor inserts the step that opens it — and refuses the join outright if the two could never fit.',
      },
      configure: {
        title: 'Tell it which folder',
        body: 'Select a step to configure it on the right. Watch Folder needs to know which folder to watch, and Save File needs to know where to put the result.',
      },
      allow: {
        title: 'Allow it that folder',
        body: 'A component cannot touch anything until you say so, and a permission is scoped to the one folder you pick. Press Allow on the step that asked.',
      },
      run: {
        title: 'Run it',
        body: 'Press Run, or Ctrl+Enter. Each step lights up as it happens, and the panel below records what it did and how long it took.',
      },
    },
    welcome: {
      title: 'Welcome to Encastra',
      lead: 'Build software by assembling components. You pick the parts, connect them, and press run — on this machine, with nothing reaching your files until you allow it.',
      createFirst: {
        title: 'Create your first workflow',
        note: 'A short guided run through, about a minute',
      },
      exploreSample: {
        title: 'Explore a sample',
        note: '{name}, already built — you choose its folders',
      },
      skip: {
        title: 'Skip',
        note: 'Go straight in. This is in Settings if you want it later.',
      },
    },
  },

  // Status-bar messages `store.ts` sets after an action — saving, running, loading a sample.
  // `messages.saved`/etc. are looked up with `translate()` from that plain store module, the same
  // way `canvas/Canvas.tsx` does inside `isConnectionLegal` — see `i18n/index.ts`'s own note on
  // why: a store action has no React render to call `useTranslation()` from.
  messages: {
    untitledProject: 'Untitled',
    recordingNote: 'This is a recording, not a run on this machine.',
    problemsToFix: {
      one: '{count} problem to fix.',
      other: '{count} problems to fix.',
    },
    readyToRun: 'This graph is ready to run.',
    nothingRanProblems: {
      one: 'Nothing ran: {count} problem to fix first.',
      other: 'Nothing ran: {count} problems to fix first.',
    },
    saved: {
      one: 'Saved. {count} version kept.',
      other: 'Saved. {count} versions kept.',
    },
    watchingChanges: 'Watching. It will run whenever something appears.',
    running: 'Running.',
    stopping: 'Stopping.',
    demoLoaded: '{name}: fill in {needs}, then start it.',
    restored: 'Restored. The version you came from is still in the history.',
    missingComponents: 'This project needs {missing}, which is not installed.',
    runtimeSilent: 'Something in the runtime did not answer.',
  },

  // The three sample workflows `demos.ts` ships (the graph shape itself stays English-only
  // component config, same as any project — only the name, summary and folder prompts a person
  // actually reads are here). `Home.tsx` and `onboarding/Welcome.tsx` both read these by key.
  demos: {
    imageProcessor: {
      name: 'Image Processor',
      summary:
        'Watches a folder. Whenever an image appears, it makes a smaller copy in another folder.',
      needs: {
        watch: 'A folder to watch',
        save: 'A folder to save into',
      },
    },
    fileOrganiser: {
      name: 'File Organiser',
      summary:
        'Watches a folder and moves what lands in it into one of three others, by file type.',
      needs: {
        watch: 'A folder to watch',
        images: 'A folder for images',
        documents: 'A folder for documents',
      },
    },
    thumbnails: {
      name: 'Thumbnails',
      summary: 'Turns a folder of images into square previews, ready for a gallery or a grid.',
      needs: {
        watch: 'A folder to watch',
        save: 'A folder to save into',
      },
    },
  },

  // A generous tree for the Settings screen, following its eighteen categories in
  // `settings/categories.ts` and the controls in `views/Settings.tsx` one for one, so a key here
  // is a key that screen can use verbatim. `shared` holds the handful of rows — On startup, the
  // Runtime and Signing status, the Version row, the Open Security button, "Not built yet",
  // "None collected", and the schema-number template — that appear word for word in more than one
  // category, because `About` is a summary that repeats parts of Runtime, Security, Updates and
  // Projects. One key each, so the two places these show up can never drift apart the way
  // `categories.ts` and this file once did.
  settings: {
    eyebrow: 'Settings',
    nav: {
      ariaLabel: 'Settings categories',
    },
    categories: {
      general: {
        label: 'General',
        description: 'Get started, and what this application shows you when it opens.',
      },
      appearance: {
        label: 'Appearance',
        description: 'Theme and motion.',
      },
      language: {
        label: 'Language & Region',
        description: 'The language this interface speaks, and how it shows dates and numbers.',
      },
      workspace: {
        label: 'Workspace',
        description: 'Where your projects live on disk.',
      },
      projects: {
        label: 'Projects',
        description: 'How a project opens, and the format it is saved in.',
      },
      editor: {
        label: 'Editor',
        description: 'Shortcuts and behaviour while you build a graph.',
      },
      canvas: {
        label: 'Canvas',
        description: 'Aids drawn on the canvas itself: the grid, snapping, the minimap.',
      },
      runtime: {
        label: 'Runtime',
        description: 'What happens on screen while a workflow runs.',
      },
      components: {
        label: 'Components',
        description: 'What is installed in this build, and exactly what each one can reach.',
      },
      security: {
        label: 'Security',
        description: 'The permission model, in short. The full detail lives on its own screen.',
      },
      privacy: {
        label: 'Privacy',
        description: 'What this application collects and sends, stated as fact.',
      },
      notifications: {
        label: 'Notifications',
        description: "Where a workflow's notifications appear, and where they do not.",
      },
      files: {
        label: 'Files',
        description: 'What Encastra writes to disk, and what it does not.',
      },
      updates: {
        label: 'Updates',
        description: 'How a newer version reaches this machine.',
      },
      account: {
        label: 'Account',
        description: 'Sign-in, subscriptions, and why there are none.',
      },
      developer: {
        label: 'Developer',
        description: 'Internals for people who want them, and a way back to the defaults.',
      },
      diagnostics: {
        label: 'Diagnostics',
        description: 'What this build and this machine report, ready to paste into a bug report.',
      },
      about: {
        label: 'About',
        description: 'Build, versions, and where the fuller documentation lives.',
      },
    },

    // Rows that appear, word for word, in more than one category — see the note above.
    shared: {
      startup: {
        label: 'On startup',
        hint: 'What this application shows you when it opens.',
        options: {
          home: 'Home',
          lastProject: 'Last project',
        },
      },
      runtimeStatus: {
        label: 'Runtime',
        hint: 'Whether a real Encastra runtime is attached to this window.',
        attached: 'Attached',
        notAttached: 'Not attached — browser preview',
      },
      signing: {
        label: 'Signing',
        hint: 'Whether this build can prove who produced it.',
        status: 'Not signed',
      },
      version: {
        label: 'Version',
        hint: 'The build you are running.',
        unknown: 'unknown',
      },
      openSecurity: 'Open Security',
      notBuilt: 'Not built yet',
      noneCollected: 'None collected',
      /** `{value}` is a schema number, or `?` when the build has not reported one yet. */
      schemaValue: 'schema {value}',
      projectFormatHint: 'What a saved .encastra file is written as.',
    },

    general: {
      title: 'Get started',
      welcomeTour: {
        label: 'Welcome tour',
        hint: 'The guided first workflow, shown once on first run.',
        button: 'Show the welcome again',
      },
    },

    appearance: {
      title: 'Appearance',
      theme: {
        label: 'Theme',
        hint: 'System follows your operating system. Light and dark stay fixed regardless of it.',
        options: {
          system: 'System',
          light: 'Light',
          dark: 'Dark',
        },
      },
      motion: {
        label: 'Motion',
        hint: 'Reduced turns transitions off entirely rather than shortening them, regardless of what your system prefers.',
        options: {
          system: 'System',
          reduced: 'Reduced',
        },
      },
    },

    language: {
      interface: {
        title: 'Language',
        picker: {
          label: 'Interface language',
          hint: 'Translates this application. English is always the fallback for anything not yet translated in the language you pick.',
        },
        loading: 'Loading…',
        loadError: 'Could not load {name}. Staying on the current one.',
        comingLater: {
          label: 'Coming later',
          hint: 'The interface is structured to support these; nobody has translated them yet.',
        },
      },
      formatting: {
        title: 'How this locale writes things',
        dates: {
          label: 'Dates',
          hint: "Today, in this locale's own order and words.",
        },
        times: {
          label: 'Times',
          hint: "The current time, in this locale's own convention.",
        },
        numbers: {
          label: 'Numbers',
          hint: 'An example number, grouped the way this locale groups them.',
        },
        note: 'Every date, time and number this application shows follows the language above — there is no separate format to choose, the same way there is not in most software that gets this right.',
      },
    },

    workspace: {
      title: 'Startup',
      lastProject: {
        label: 'Last project',
        hint: 'Recorded automatically whenever you open or save one. Used when On startup is set to Last project — one that has since moved or been deleted is quietly forgotten rather than shown as an error.',
        none: 'None yet',
      },
    },

    projects: {
      location: {
        title: 'Where they open from',
        label: 'Default project folder',
        hint: 'Where the save dialog starts. Left empty, it opens wherever the system last was.',
        placeholder: 'No default folder set',
        browse: 'Browse…',
        browseUnavailable: 'Needs the desktop runtime, not this browser preview',
      },
      format: {
        title: 'Format',
        label: 'Project file format',
      },
      notBuilt: {
        title: 'Not built yet',
        copy: 'There is no recent-projects list. Settings are per machine rather than per project — a project opened on a different machine does not carry its own preferences with it, only the graph itself.',
      },
    },

    editor: {
      shortcuts: {
        title: 'Keyboard shortcuts',
        table: {
          shortcut: 'Shortcut',
          action: 'Action',
        },
        actions: {
          runOrWatch: 'Run the workflow, or start watching if it opens with a trigger',
          save: 'Save',
          saveAs: 'Save as',
          openProject: 'Open a project',
          undo: 'Undo',
          redo: 'Redo',
          copySelection: 'Copy the selection',
          paste: 'Paste',
          duplicateSelection: 'Duplicate the selection',
          selectAll: 'Select all',
          deleteSelection: 'Delete the selection',
        },
        note: 'Fixed today rather than remappable. None of these fire while you are typing into a text field.',
      },
      notBuilt: {
        title: 'Not built yet',
        copy: 'Autosave, a configurable save interval, and customising the shortcuts above are not built yet.',
      },
    },

    canvas: {
      title: 'Canvas',
      grid: {
        label: 'Grid',
        hint: 'Shows the alignment grid behind nodes on the canvas.',
      },
      snapToGrid: {
        label: 'Snap to grid',
        hint: 'Nodes settle onto the grid as you drag them, instead of landing free.',
      },
      minimap: {
        label: 'Minimap',
        hint: 'A small overview of the whole graph in the corner of the canvas.',
      },
    },

    runtime: {
      runs: {
        title: 'Runs',
        openRunPanel: {
          label: 'Open the run panel',
          hint: 'Bring the execution panel forward automatically the moment a run starts.',
          toggleLabel: 'Open the run panel on run',
        },
      },
      notBuilt: {
        title: 'Not built yet',
        copy: 'Running steps in parallel, execution timeouts, retry limits and per-run resource limits are not configurable. A workflow runs its steps in the order validation settled on, to completion or failure, with whatever time and memory the machine gives it.',
      },
    },

    components: {
      installed: {
        title: 'Installed',
        components: {
          label: 'Components',
          hint: 'Everything this build ships with, built in rather than downloaded.',
          builtIn: '{count} built in',
        },
        thirdParty: {
          label: 'Third-party',
          hint: 'Components from outside this application, run in a sandbox with no ambient authority.',
          installed: '{count} installed',
          notBuilt: 'Sandbox not built yet',
        },
        permissionTable: {
          label: 'Full permission table',
          hint: 'Every installed component, its version, and exactly what it can reach.',
        },
      },
      table: {
        title: 'Every component, and what it can reach',
        headers: {
          component: 'Component',
          version: 'Version',
          source: 'Source',
          canReach: 'Can reach',
        },
        kind: {
          core: 'built in',
          thirdParty: 'third-party',
        },
        none: 'nothing',
        note: 'Nothing outside this list is installed, and nothing here can reach anything its own row does not name — no arbitrary file access, no shell, no network beyond what is listed.',
      },
      capabilityLabels: {
        fsRead: 'Read files',
        fsWrite: 'Write files',
        netHttp: 'Use the network',
        systemNotify: 'Show notifications',
        systemClipboard: 'Use the clipboard',
      },
      installMore: {
        title: 'Install more',
        installFromFile: {
          label: 'Install from a file',
          hint: 'Add a third-party component to this build.',
        },
        note: 'The sandbox this would run components in is designed and documented but not built, so nothing outside the {count} listed above can be installed yet.',
      },
    },

    security: {
      title: 'Permission model',
      copy: 'A component cannot reach your files, your network, or your clipboard unless its manifest declares it and you allow it — once per run. Every request, allowed or refused, is recorded where you can read it.',
      thirdParty: {
        label: 'Third-party components',
        hint: 'Whether anything outside this build can be installed and run.',
        status: 'Not possible yet — the sandbox is not built',
      },
      allowedInOpenWorkflow: {
        label: 'Allowed in the open workflow',
        hint: 'Cleared the moment this application closes.',
        nothingAllowed: 'Nothing allowed',
        allowed: '{count} allowed',
      },
      fullDetail: {
        label: 'Full detail',
        hint: 'What was allowed, to what, and what this does not protect against.',
      },
    },

    privacy: {
      collect: {
        title: 'What this application could collect, and does not',
        telemetry: {
          label: 'Telemetry',
          hint: 'Usage data — which features get used, how often — sent to a server so a team could prioritise its work.',
        },
        crashReports: {
          label: 'Crash reports',
          hint: 'A stack trace and a build version, sent automatically when something fails, so it could be fixed without you filing it yourself.',
        },
        analytics: {
          label: 'Usage analytics',
          hint: "Feature counts, session length, or anything else that would turn how you use this application into a number on someone else's dashboard.",
        },
        note: 'All three would need a server to send to. There is none — an "off" switch here would imply a mechanism that does not exist.',
      },
      account: {
        title: 'Account',
        signIn: {
          label: 'Sign-in',
          hint: 'An identity tied to this application, the way most software with a server asks for one.',
          status: 'None — there is no server to sign in to',
        },
      },
      yourData: {
        title: 'Your data',
        projects: {
          label: 'Projects',
          hint: 'Kept as .encastra files wherever you save them. No hidden second copy.',
          status: 'Stays on this machine',
        },
        runJournals: {
          label: 'Run journals',
          hint: 'Record sizes and shapes, never file contents. Held in memory while the window is open.',
          status: 'Discarded on close',
        },
      },
    },

    notifications: {
      window: {
        title: 'In this window',
        toast: {
          label: 'Toast notifications',
          hint: 'A workflow can ask to show one, using the same system.notify capability as any other permission — declared in its manifest and allowed before anything appears.',
          shown: '{count} shown this session',
        },
        note: 'Up to the most recent 20 are kept while the window is open; dismissing them clears the list. Closing the application forgets them, the same as everything else that is not a saved project.',
      },
      notBuilt: {
        title: 'Not built yet',
        copy: 'There is no operating-system notification permission, no email, and no push notification — nothing reaches you outside this window. A history of past notifications beyond the current session is not built either.',
      },
    },

    files: {
      disk: {
        title: 'What lives on disk',
        projects: {
          term: 'Projects',
          detail: 'files, wherever you choose to save them — see Projects for the default folder.',
        },
        preferences: {
          term: 'Preferences',
          detail:
            "Browser storage in this application's own origin, not a file you can open directly.",
        },
        componentData: {
          term: 'Component data',
          detail:
            'None. Every component in this build is compiled in; nothing is downloaded or cached.',
        },
        logs: {
          term: 'Logs',
          detail:
            'None written to disk. A run journal is held in memory while the window is open and discarded when it closes.',
        },
      },
      notBuilt: {
        title: 'Not built yet',
        copy: 'There is no import or export of settings, and no way to move preferences between machines short of setting them again there. A project itself is already portable — it is one file — but the preferences on this screen are not.',
      },
    },

    updates: {
      thisBuild: {
        title: 'This build',
        channel: {
          label: 'How a newer one reaches this machine',
          hint: 'What happens when a new version ships.',
          fact: 'No update channel. Updating means downloading a fresh installer and replacing this one.',
        },
      },
      verify: {
        title: 'Verifying what you install',
        copy: 'Builds are not code-signed, so Windows will warn about an unrecognised publisher — an accurate warning, since nothing here proves who produced the file. Each release publishes a SHA-256 hash instead, to check an installer against before running it.',
      },
      notBuilt: {
        title: 'Not built yet',
        copy: 'Automatic update checks, update channels as a working mechanism, and background downloads are not built. Checking for a new version today means checking by hand.',
      },
    },

    account: {
      title: 'No accounts',
      copy: 'There is no sign-in, no account, and no server for one to talk to. Nothing here has a subscription, a plan, a session, or a list of devices to manage — every project and every preference on this screen lives on this machine, and only on this machine.',
    },

    developer: {
      internals: {
        title: 'Internals',
        developerMode: {
          label: 'Developer mode',
          hint: 'Surfaces the raw preference values and a compact summary of every loaded component, below.',
        },
      },
      currentPreferences: {
        title: 'Current preferences',
      },
      loadedComponents: {
        title: 'Loaded components',
      },
      hidden: {
        title: 'Currently hidden',
        copy: 'Turn on developer mode above to see the raw preference values and a summary of every loaded component.',
      },
      reset: {
        title: 'Reset',
        restoreDefaults: {
          label: 'Restore defaults',
          hint: 'Puts every setting on this screen back to how it was on first run. Does not touch your projects, grants, or installed components.',
          button: 'Reset all settings',
        },
      },
    },

    diagnostics: {
      rows: {
        version: 'Encastra version',
        runtime: 'Runtime',
        protocolSchema: 'Component protocol schema',
        projectSchema: 'Project format schema',
        components: 'Installed components',
        platform: 'Platform',
        architecture: 'Architecture',
        gpu: 'GPU',
        userAgent: 'WebView user agent',
        gpuUnknown: 'Not discoverable',
        platformUnknown: 'Unknown',
        architectureUnknown: 'Not reported by the WebView',
      },
      machine: {
        title: 'This machine and this build',
      },
      share: {
        title: 'Share it',
        copy: {
          label: 'Copy',
          hint: 'Copies every line above to the clipboard.',
          button: 'Copy',
          copied: 'Copied',
          failed: 'Could not copy',
        },
        export: {
          label: 'Export',
          hint: 'Saves the same report as a text file.',
          button: 'Export…',
        },
        note: 'Nothing here includes a project path, a preference value, or a token — it is meant to be safe to paste somewhere public. The report itself is copied and exported in English, so anyone on the project can read it.',
      },
    },

    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Build software from parts that actually fit.',
      },
      thisBuild: {
        title: 'This build',
        componentProtocol: {
          label: 'Component protocol',
          hint: 'What a component manifest must match to load.',
        },
        projectFormat: {
          label: 'Project format',
        },
        updates: {
          label: 'Updates',
          hint: 'How a newer version reaches this machine.',
          fact: 'No update channel. Updating means downloading a new installer.',
        },
      },
      readMore: {
        title: 'Read more',
        readme: 'what Encastra is',
        security: 'the permission model, in full',
        release: 'how a build is produced and verified',
        roadmap: 'what is built, and what is not yet',
      },
    },
  },
};

export default en;
