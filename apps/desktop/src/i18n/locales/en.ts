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

  // A generous tree for the Settings screen, following its categories in `settings/categories.ts`
  // and the controls in `views/Settings.tsx` one for one, so a key here is a key that screen can
  // use verbatim.
  settings: {
    eyebrow: 'Settings',
    nav: {
      ariaLabel: 'Settings categories',
    },
    categories: {
      general: {
        label: 'General',
        description: 'Appearance, motion, and the first-run tour.',
      },
      workspace: {
        label: 'Workspace',
        description: 'Where projects live, and what this application opens to.',
      },
      editor: {
        label: 'Editor',
        description: 'Aids shown on the canvas while you build a graph.',
      },
      runtime: {
        label: 'Runtime',
        description: 'What happens on screen while a workflow runs.',
      },
      components: {
        label: 'Components',
        description: 'What is installed in this build, and what each one can reach.',
      },
      security: {
        label: 'Security',
        description: 'The permission model, in short. The full detail lives on its own screen.',
      },
      privacy: {
        label: 'Privacy',
        description: 'What this application collects and sends, stated as fact.',
      },
      advanced: {
        label: 'Advanced',
        description: 'Internals for people who want them, and a way back to the defaults.',
      },
      about: {
        label: 'About',
        description: 'Build, versions, and where the fuller documentation lives.',
      },
    },
    general: {
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
      getStarted: {
        title: 'Get started',
        welcomeTour: {
          label: 'Welcome tour',
          hint: 'The guided first workflow, shown once on first run.',
          button: 'Show the welcome again',
        },
      },
    },
    workspace: {
      projects: {
        title: 'Projects',
        folder: {
          label: 'Default project folder',
          hint: 'Where the save dialog starts. Left empty, it opens wherever the system last was.',
          placeholder: 'No default folder set',
          browseTitleUnavailable: 'Needs the desktop runtime, not this browser preview',
        },
        startup: {
          label: 'On startup',
          hint: 'What this application shows you when it opens.',
          options: {
            home: 'Home',
            lastProject: 'Last project',
          },
        },
      },
    },
    editor: {
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
    },
    runtime: {
      runs: {
        title: 'Runs',
        openRunPanel: {
          label: 'Open the run panel',
          hint: 'Bring the execution panel forward automatically the moment a run starts.',
        },
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
          button: 'Open Security',
        },
      },
      installMore: {
        title: 'Install more',
        installFromFile: {
          label: 'Install from a file',
          hint: 'Add a third-party component to this build.',
          status: 'Not built yet',
        },
        note: 'The sandbox this would run components in is designed and documented but not built, so nothing outside the {count} listed above can be installed yet.',
      },
    },
    security: {
      permissionModel: {
        title: 'Permission model',
        copy: 'A component cannot reach your files, your network, or your clipboard unless its manifest declares it and you allow it — once per run. Every request, allowed or refused, is recorded where you can read it.',
        allowedInOpenWorkflow: {
          label: 'Allowed in the open workflow',
          hint: 'Cleared the moment this application closes.',
          nothingAllowed: 'Nothing allowed',
          allowed: '{count} allowed',
        },
        fullDetail: {
          label: 'Full detail',
          hint: 'What was allowed, to what, and what this does not protect against.',
          button: 'Open Security',
        },
      },
    },
    privacy: {
      collection: {
        title: 'Collection',
        telemetry: {
          label: 'Telemetry',
          hint: 'Usage data sent back to a server.',
          status: 'None collected',
        },
        crashReports: {
          label: 'Crash reports',
          hint: 'Automatic reports sent somewhere when something fails.',
          status: 'None',
        },
        analytics: {
          label: 'Analytics',
          hint: 'Usage patterns, feature counts, or anything similar.',
          status: 'None',
        },
        account: {
          label: 'Account',
          hint: 'A sign-in or subscription tied to this application.',
          status: 'None — there is no server',
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
    advanced: {
      internals: {
        title: 'Internals',
        developerMode: {
          label: 'Developer mode',
          hint: 'Surfaces component ids, digests, and the raw run journal for people who want them.',
        },
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
    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Build software from parts that actually fit.',
      },
      thisBuild: {
        title: 'This build',
        version: {
          label: 'Version',
          hint: 'The build you are running.',
          unknown: 'unknown',
        },
        runtime: {
          label: 'Runtime',
          hint: 'Whether a real Encastra runtime is attached to this window.',
          attached: 'Attached',
          notAttached: 'Not attached — browser preview',
        },
        componentProtocol: {
          label: 'Component protocol',
          hint: 'What a component manifest must match to load.',
        },
        projectFormat: {
          label: 'Project format',
          hint: 'What a saved .encastra file is written as.',
        },
        signing: {
          label: 'Signing',
          hint: 'Whether this build can prove who produced it.',
          status: 'Not signed',
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
