/**
 * English. The source of truth: every key used anywhere in the interface exists here first, and
 * every other locale file is checked against this one.
 */

import type { Messages } from '../index';

const en: Messages = {
  common: {
    close: 'Close',
    dismiss: 'Dismiss',
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
