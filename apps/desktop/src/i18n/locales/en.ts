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
    projectFileType: 'Encastra project',
  },

  sidebar: {
    ariaLabel: 'Sections',
    running: ', running',
    items: {
      home: 'Home',
      builder: 'Builder',
      library: 'Library',
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
      library: {
        title: 'Open from your library',
        detail: 'What you made, took in, or prepared',
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
    controls: {
      panel: 'Canvas controls',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fitView: 'Fit the workflow in view',
      minimap: 'Minimap',
    },
    ariaLabel: 'Workflow canvas',
    refusal: {
      selfCycle: {
        headline: 'A step cannot feed itself.',
        detail:
          'A workflow runs forwards. To do the same work repeatedly, start it from a trigger — Watch Folder or Timer — which runs it once per event.',
      },
      bridge: 'A step producing {bridge} in between would join them.',
      // Every wording a refused connection is built from — see `canvas/refusal.ts`.
      //
      // `cannotFeed`, `listOf` and `optional` are whole constructions with a placeholder
      // in them rather than fragments to be joined, because word order and agreement are
      // yours to decide: German puts no article in `types` and carries the case on a fixed
      // "Wert vom Typ …" instead, Spanish carries the article inside the phrase. Three
      // wordings per type, because a sentence needs a different one in each place:
      // `types` is the phrase a sentence refers to a value by, `nouns` the bare noun a
      // construction frames, `labels` the name shown on the bridge chip and in `detail`.
      cannotFeed: '{from} cannot be fed into a step that expects {to}.',
      rawType: '“{name}”',
      listOf: 'a list of {item} values',
      optional: 'an optional {item}',
      types: {
        bool: 'a boolean',
        i64: 'an integer',
        f64: 'a number',
        string: 'text',
        json: 'JSON',
        file: 'a file',
        dir: 'a folder',
        bytes: 'bytes',
        image: 'an image',
        video: 'a video',
        audio: 'audio',
      },
      nouns: {
        bool: 'boolean',
        i64: 'integer',
        f64: 'number',
        string: 'text',
        json: 'JSON',
        file: 'file',
        dir: 'folder',
        bytes: 'bytes',
        image: 'image',
        video: 'video',
        audio: 'audio',
      },
      labels: {
        bool: 'Boolean',
        i64: 'Integer',
        f64: 'Number',
        string: 'Text',
        json: 'JSON',
        file: 'File',
        dir: 'Folder',
        bytes: 'Bytes',
        image: 'Image',
        video: 'Video',
        audio: 'Audio',
      },
      detail: {
        notAType: '“{name}” is not something this build can read as a type.',
        listsDoNotMatch: 'The two lists do not hold the same thing. {inner}',
        cannotConnect: '{from} cannot connect to {to}.',
        unknownType:
          '“{name}” is not a type this runtime knows. The component may need a newer runtime version.',
        siblings:
          '{from} and {to} are both kinds of {shared}, but one is not the other. Convert through {shared} if that is what you mean.',
        noConversion: '{from} cannot become {to}. There is no conversion between them.',
      },
    },
    empty: {
      heading: 'Your canvas is empty',
      body: 'A workflow is a few components joined together. Pick one from the left to place your first step, connect its output to the next, and press Run.',
      hint: 'Every component says what it can reach before it runs, and nothing touches your files until you allow it.',
    },
    // The menu a right-click opens on the canvas. Removing a step was always possible from
    // the keyboard; this is where somebody finds out that it is.
    menu: {
      label: 'Canvas actions',
      connect: 'Connect from here…',
      duplicate: 'Duplicate',
      disable: 'Switch off',
      enable: 'Switch on',
      deleteStep: 'Delete step',
      deleteConnection: 'Delete connection',
      paste: 'Paste',
      selectAll: 'Select all',
      undo: 'Undo',
      redo: 'Redo',
      // The same items when the right-click landed inside a selection of several steps, which
      // keeps that selection rather than narrowing to the one under the pointer. Counted
      // through the locale's own plural rules, never by gluing an "s" onto a word.
      many: {
        duplicate: {
          one: 'Duplicate {count} step',
          other: 'Duplicate {count} steps',
        },
        disable: {
          one: 'Switch off {count} step',
          other: 'Switch off {count} steps',
        },
        enable: {
          one: 'Switch on {count} step',
          other: 'Switch on {count} steps',
        },
        delete: {
          one: 'Delete {count} step',
          other: 'Delete {count} steps',
        },
      },
    },
    keysHint:
      'Use the arrow keys to move between steps, Enter to open a step in the inspector, C to start a connection from the selected step, E to move through the connections it already has, Delete to remove whichever of the two is held, and Escape to let go.',
    // Making a connection without a mouse. Every one of these is read out rather than seen, so
    // they are whole sentences: a screen reader has no canvas to glance at.
    connect: {
      started:
        'Connecting from {from}. {targets}. Arrow keys to choose, Enter to connect, Escape to cancel.',
      targets: {
        one: '{count} possible target',
        other: '{count} possible targets',
      },
      connected: 'Connected.',
      cancelled: 'Cancelled.',
      noTargets: 'Nothing on this canvas can take what {step} produces.',
      noOutputs: '{step} produces nothing to connect from.',
    },
    // Holding a connection that already exists, so it can be heard and removed.
    connection: {
      focused: 'Connection from {from} to {to}.',
      removed: 'Connection removed.',
      none: '{step} has no connections yet.',
    },
    a11y: {
      selected: '{name}, step {index} of {total}, selected.',
      /** One end of a connection, said as one unit: a step and one of its ports. */
      port: '{step} · {port}',
    },
    node: {
      /** Shown on a node whose `componentRef` this build has no manifest for — the graph
       * references something that is not part of it. */
      notInstalled: 'Not installed.',
      // The state of a step said in a shape as well as a colour, keyed exactly as
      // `runPanel.status.*` is. Here rather than in the component because everything a person
      // reads belongs in this tree — and because a locale that would rather not use a tick has
      // somewhere to say so.
      glyphs: {
        pending: '·',
        running: '…',
        ok: '✓',
        failed: '✕',
        skipped: '–',
        cancelled: '⊘',
        disabled: '–',
      },
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

  publish: {
    heading: 'Prepare a publication',
    intro:
      'Encastra reads the saved project the way somebody receiving it would, then writes it into a folder you choose, along with the document that would travel with it. Nothing is uploaded: there is no registry to send it to, and no account to send it with.',
    saveFirst: 'Save the project first. What gets published is the file, and there is not one yet.',
    saveChangesFirst:
      'Save your changes first. What gets published is the file on disk, and it no longer matches the canvas.',
    sections: {
      about: 'What this is',
      check: 'What Encastra found',
      done: 'Where it went',
    },
    fields: {
      title: {
        label: 'Name',
        hint: 'What it is called on a page somebody is deciding from.',
      },
      summary: {
        label: 'Summary',
        hint: 'A sentence or two: what it does, and who it is for.',
      },
      namespace: {
        label: 'Your namespace',
        hint: 'A reverse domain name you control, like dev.yourname. Nobody has checked it — there are no accounts — so it is a claim, not proof.',
      },
      version: {
        label: 'Version',
        hint: 'Numbered like 1.0.0. A published version never changes; a change gets a new number.',
      },
      kind: {
        label: 'Kind',
        hint: 'A project is meant to be run. A template is meant to be taken apart and changed.',
      },
      licence: {
        label: 'Licence',
        hint: 'What somebody else may do with it. A part whose licence conflicts with this one is refused.',
      },
    },
    kinds: {
      project: 'Project',
      template: 'Template',
    },
    licences: {
      mit: 'MIT',
      'apache-2.0': 'Apache-2.0',
      'gpl-3.0-only': 'GPL-3.0-only',
      proprietary: 'All rights reserved',
    },
    derivedName: 'It would be known as',
    freeOnly:
      'Free, and only free. There is no payment provider and no account to charge, so a price here would be a number nothing could ever take.',
    checking: 'Reading the project…',
    checkAgain: 'Check again',
    prepare: 'Prepare…',
    nothingFound: 'Nothing here would stop this being published.',
    notAnAudit:
      'This finds the mistakes that are mechanical enough to find. It is not a security audit, and nobody has done one.',
    capabilities: {
      none: 'It asks for nothing outside itself.',
      some: 'Whoever installs this is asked, every run, before it can use:',
    },
    preparedInto: 'The project and its publication document are here:',
    nowhereToSend: 'They stay on this machine. There is nowhere to send them yet.',
    problems: {
      namespaceMissing: 'A publication needs a namespace.',
      namespaceShape: 'A namespace is a reverse domain name, like dev.yourname.',
      titleMissing: 'A publication needs a name.',
      titleUnusable: 'This name has no letters or numbers to build an id from.',
      summaryMissing: 'A publication needs a summary.',
      summaryShort: 'A few words tell somebody deciding nothing. Say what it does.',
      versionShape: 'A version is numbered like 1.0.0.',
    },
  },
  // What somebody has: what they made, what they took in, and what they prepared to hand
  // on. Every sentence here is about files on this machine — there is no account and nothing
  // syncs, and the screen says so rather than leaving somebody to wonder.
  library: {
    preparedNotOpenable:
      'A prepared publication is a folder to hand to somebody, not a project to open. Open the project it was made from instead.',
    heading: 'Your library',
    intro:
      'Everything you have: the projects you made, what you took in from somebody else, and the folders you prepared to hand on. All of it is on this machine. Nothing here is synced, uploaded or shared with anyone.',
    import: 'Import…',
    importTitle: 'Read a publication folder somebody gave you',
    importUnavailable: 'Needs the desktop application',
    search: {
      placeholder: 'Search',
      ariaLabel: 'Search your library',
    },
    sort: {
      label: 'Order',
      name: 'By name',
      recent: 'Most recent',
      origin: 'By where it came from',
    },
    noMatches: 'Nothing here matches that.',
    quarantined:
      'The previous list could not be read, so it was set aside as {name} and a new one started. Nothing was deleted, and none of your projects was touched.',
    origin: {
      created: 'Made here',
      imported: 'Imported',
      prepared: 'Prepared',
    },
    status: {
      missing: {
        label: 'Not there',
        detail:
          'Nothing is at the place this points to any more. It was moved or deleted outside Encastra, which is yours to do — this line is out of date, not wrong.',
      },
      changed: {
        label: 'Changed',
        detail:
          'The file is there, and what is in it differs from the last time Encastra looked. Something edited it somewhere else.',
      },
    },
    facts: {
      version: 'Version',
      publisher: 'Publisher',
      steps: 'Steps',
      when: 'Last',
    },
    row: {
      opened: 'Opened {when}',
      added: 'Added {when}',
      publisherClaim:
        '{publisher} — claimed, not verified. There are no accounts, so nobody has checked it.',
      steps: {
        one: '{count} step',
        other: '{count} steps',
      },
    },
    reach: {
      none: 'It asks for nothing outside itself.',
      someLabel: 'It will ask to reach:',
      asksEveryRun: 'Having it here grants none of this. Every run asks.',
    },
    actions: {
      open: 'Open',
      remove: 'Remove…',
    },
    remove: {
      cancel: 'Keep it',
      keepsFile: 'This takes it off the list only. Your file stays exactly where you put it.',
      forget: 'Take it off the list',
      importedNote:
        'Encastra made this copy, so it can delete it. Your choice: the copy goes, or it stays where it is.',
      andDeleteCopy: 'Remove and delete the copy',
      keepCopy: 'Remove, keep the copy',
      refused:
        'That file is yours, and it stays where it is. Encastra only deletes copies it made itself.',
    },
    empty: {
      heading: 'Nothing here yet',
      body: 'Three things end up on this list, and each of them starts with something you do.',
      ways: {
        created: 'A project you save is added to it.',
        imported:
          'A publication folder somebody gave you is added when you import it — after Encastra has read it and you have said yes.',
        prepared: 'A folder you prepare to hand on is added when you prepare it.',
      },
      build: 'Build something',
      buildTitle: 'Open the builder and start from an empty canvas',
    },
  },

  // Taking a publication in. `errors.*` is one sentence per refusal the runtime can return,
  // never a bucket: a folder holding two projects and a document naming somebody else's
  // namespace are different problems with different things to do about them. `library.ts` maps
  // the runtime's tag to the key, and its test checks that every tag has one.
  import: {
    heading: 'Take in a publication',
    intro:
      'Encastra has read the folder you chose the way somebody receiving it should: it checked the file against the document beside it, and ran the publisher’s own check again here. Nothing has been written, and nothing has run.',
    reading: 'Reading the folder…',
    writing: 'Copying this into your library. This will not take long.',
    confirm: 'Import',
    nothing: 'nothing',
    copiesNothingRuns:
      'Importing copies the files into your library. Nothing runs until you open it and press Run.',
    nothingWasTakenIn: 'Nothing was taken in, and nothing on this machine was changed.',
    sections: {
      what: 'What this says it is',
      integrity: 'Whether the file is the one described',
      inside: 'What is inside',
      asks: 'What it would ask for',
      check: 'What Encastra found',
    },
    facts: {
      publisher: 'Publisher',
      name: 'Known as',
      version: 'Version',
      kind: 'Kind',
      licence: 'Licence',
      size: 'Size',
      kilobytes: '{size} kB',
      runtime: 'Runs on',
      projectName: 'Project',
      steps: 'Steps',
      stepCount: {
        one: '{count} step',
        other: '{count} steps',
      },
      switchedOff: ' ({count} switched off)',
      versions: 'Versions kept',
      versionCount: {
        one: '{count} version',
        other: '{count} versions',
      },
    },
    kinds: {
      project: 'Project',
      template: 'Template',
      component: 'Component',
    },
    notVerified:
      'Nobody has checked that this publisher is who the name says. There are no accounts, so there is nobody who could have.',
    checksumMatches: 'The file matches the checksum in the document beside it.',
    checksumIsNotProvenance:
      'That proves the file was not altered since it was prepared. It says nothing about who prepared it.',
    capabilities: {
      none: 'It asks for nothing outside itself.',
      some: 'When it runs, it will ask to use:',
      grantsNothing: 'Importing grants none of this. Each run asks before anything is reached.',
    },
    nothingFound: 'Nothing here would stop this being taken in.',
    notAnAudit:
      'This finds the mistakes that are mechanical enough to find. It is not a security audit, and nobody has done one.',
    disagreement: {
      declared: 'The document says',
      actual: 'The project asks for',
    },
    tokens: {
      title: 'title',
      summary: 'summary',
      changelog: 'changelog',
      publisher: 'publisher',
      categories: 'categories',
      tags: 'tags',
      runtime: 'runtime',
    },
    errors: {
      notAFolder:
        'That is not a folder. A publication is a folder holding a project and the document that describes it.',
      folderIsALink:
        'That folder is a link to somewhere else. Encastra will not follow it, because then what it read and what you chose would not be the same thing. Pick the folder itself.',
      folderNotChosen:
        'That folder was not picked in this session. Choose it with the folder chooser, so that what Encastra reads is what you pointed at.',
      noDocument:
        'There is no publication.json in that folder, so nothing in it says what it is. That is a folder of files, not a publication.',
      documentIsALink:
        'publication.json is a link to another file rather than a file. Encastra reads what is in the folder you chose, and nothing outside it.',
      documentTooLarge:
        'publication.json is about {size} kB, and this build reads at most {max} kB. A publication document is a page of text; one this large is not one.',
      documentUnreadable:
        'publication.json could not be read: {reason}. Ask whoever prepared it to prepare it again.',
      noProject:
        'There is no .encastra file in that folder. A publication is one project and the document describing it.',
      moreThanOneProject:
        'A publication is one project, and that folder holds {count}: {names}. Whoever prepared it should send one folder per project.',
      projectIsALink:
        'The project file is a link to another file rather than a file. Encastra installs what is in the folder you chose, and nothing outside it.',
      unexpectedEntries:
        'A publication folder holds a document and a project, and nothing else. This one also holds {names}. Encastra will not take in a folder it cannot account for.',
      tooManyEntries:
        'A publication folder holds a document and a project, and nothing else. This one holds more than {max} entries, which is not a publication whatever they are.',
      projectTooLarge: 'The project is about {size} kB, and this build installs at most {max} kB.',
      checksumMismatch:
        'The project file is not the one this publication describes. Either the document describes a different file, or the file changed on the way here. Ask for it again.',
      projectUnreadable:
        'The project file could not be read: {reason}. It may have been made by a newer version of Encastra, or damaged on the way here.',
      notInstallable: 'This build cannot install a {publicationKind}, so it will not pretend to.',
      notAListingId:
        '“{id}” is not a publication name, so there is no safe name to file this under.',
      notAVersion: '“{version}” is not a version. Publications are numbered like 1.2.0.',
      notPublishersNamespace:
        '“{listing}” is not inside {publisher}’s namespace. The document names one publisher and a publication belonging to another, and Encastra cannot tell which of the two is the mistake.',
      textTooLong: 'The {field} is longer than this build will read (at most {max} characters).',
      textHasControlCharacters:
        'The {field} holds characters that can hide what it really says — the kind that make one name look like another. Encastra refuses it rather than quietly rewriting what somebody wrote.',
      documentDisagreesWithProject:
        'The document and the project disagree about the {about}. The page describing this is describing something other than the file beside it.',
      runtimeIncompatible:
        'This publication is for a runtime {requires}, and this one is {have}. Nothing is installed for a version it was not built for.',
      reviewRefused:
        'The same check its publisher ran refuses it here. These would have to change before anybody could take it in:',
      capabilitiesDisagree:
        'The document and the project do not agree about what this asks for. Understating the permissions is the obvious problem; overstating them teaches people to skim the list, which is the subtler one. Both are refused.',
      alreadyImported:
        '{listing} {version} is already in your library. A published version never changes, so there is nothing new here to take in.',
      libraryFull:
        'Your library is full. It already holds about {used} MB of imported copies and this build keeps at most {max} MB; this one needs about {needed} MB. Remove something you no longer use and try again — nothing was taken in.',
      io: 'Something on this computer refused the operation ({reason}). Nothing was taken in.',
      unknown:
        'Encastra refused this folder for a reason this version has no words for. It was not taken in.',
    },
  },

  toolbar: {
    publish: 'Publish',
    publishTitle: 'Prepare this project for somebody else to install',
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
    categories: {
      all: 'All',
      other: 'Other',
      data: 'Data',
      file: 'Files',
      flow: 'Flow',
      media: 'Media',
      network: 'Network',
      system: 'System',
    },
    core: {
      encastra: {
        data: {
          csv: {
            read: {
              name: 'Read CSV',
              description: 'Turns comma-separated text into a list of rows.',
            },
            write: {
              name: 'Write CSV',
              description: 'Turns a list of rows into comma-separated text.',
            },
          },
          json: {
            name: 'Parse JSON',
            description: 'Turns text into structured data.',
            write: {
              name: 'Write JSON',
              description: 'Turns structured data back into text.',
            },
          },
        },
        file: {
          move: {
            name: 'Move File',
            description: 'Moves a file into another folder. The original is removed.',
          },
          read: {
            name: 'Read File',
            description: 'Reads the text content of the file connected to it.',
          },
          rename: {
            name: 'Rename File',
            description: 'Gives a file a new name, leaving it where it is.',
          },
          save: {
            name: 'Save File',
            description:
              'Puts a file into a folder you choose. Keeps the original name unless you give one.',
          },
          watch: {
            name: 'Watch Folder',
            description: 'Starts the workflow whenever a file appears in a folder.',
          },
          write: {
            name: 'Write File',
            description: 'Saves text into a file in a folder you choose.',
          },
        },
        flow: {
          delay: {
            name: 'Delay',
            description: 'Waits, then passes the value on unchanged.',
          },
          if: {
            name: 'If',
            description: 'Sends the value one way or the other depending on a condition.',
          },
          switch: {
            name: 'Switch',
            description: 'Sends the value down one of several routes depending on a word.',
          },
        },
        image: {
          convert: {
            name: 'Convert Image',
            description: 'Writes an image in a different format.',
          },
          info: {
            name: 'Image Info',
            description: "Reports an image's size and format without changing it.",
          },
          resize: {
            name: 'Resize Image',
            description: "Changes an image's size. Leave one side empty to keep the proportions.",
          },
          thumbnail: {
            name: 'Thumbnail',
            description: 'Makes a small square preview of an image.',
          },
        },
        net: {
          http: {
            name: 'HTTP Request',
            description: 'Fetches a web address, or sends data to one.',
          },
        },
        system: {
          clipboard: {
            name: 'Copy to Clipboard',
            description: 'Puts text on the clipboard, ready to paste.',
          },
          notify: {
            name: 'Notify',
            description: 'Shows a message when this step runs.',
          },
          timer: {
            name: 'Timer',
            description: 'Starts the workflow again and again, on a schedule.',
          },
        },
      },
    },
    header: {
      title: 'Components',
      summary: {
        one: '{count} installed.',
        other: '{count} installed.',
      },
      // The installed count on its own, agreeing with {count}, for `summaryWithTriggers` to
      // place where the sentence wants it; that sentence then agrees with {triggerCount}.
      installed: {
        one: '{count} installed',
        other: '{count} installed',
      },
      summaryWithTriggers: {
        one: '{installed} — {triggerCount} starts a workflow on its own; the rest run as a step inside one.',
        other:
          '{installed} — {triggerCount} of them start a workflow on their own; the rest run as a step inside one.',
      },
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
      scope:
        'Allowed while this project is open. Every run uses exactly this folder or address, and closing or switching projects forgets it.',
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
      seeRefusalReason: 'The reason it was refused is under Permissions used, below.',
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
  // The only question this application asks before work is thrown away.
  //
  // One sentence per way of throwing it away, rather than one sentence with the action
  // interpolated into it: "opening another project" and "closing Encastra" decline
  // differently in most of these languages, and a sentence with a hole in it cannot.
  unsaved: {
    title: 'Unsaved changes',
    reasons: {
      new: 'You have unsaved changes. Starting a new project would lose them.',
      open: 'You have unsaved changes. Opening another project would lose them.',
      demo: 'You have unsaved changes. Loading a sample would lose them.',
      restore: 'You have unsaved changes. Restoring an earlier version would lose them.',
      close: 'You have unsaved changes. Closing Encastra would lose them.',
      'library-open':
        'You have unsaved changes. Opening something from your library would lose them.',
    },
    save: 'Save and continue',
    discard: 'Discard changes',
    cancel: 'Cancel',
  },
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
    libraryMissing: '{name} is not where it was. Move it back, or open it from wherever it is now.',
    imported: 'Imported {name}. Nothing has run.',
    removedFromLibrary: '{name} is off the list. The file is where it was.',
    importInFlight: 'An import is being written. The window will close once it has finished.',
    removedAndDeleted: '{name} is off the list, and the copy Encastra made is deleted.',
  },

  // Every way the runtime can say no, in the reader's language.
  //
  // `AppError` in `apps/desktop/src-tauri/src/error.rs` sends a tag and the values a sentence
  // needs; `errors.ts` turns the tag into a key here. Before that existed, a refused command
  // arrived as an English sentence the runtime had built, and that sentence was shown to whoever
  // happened to be reading â which is a refusal somebody cannot act on.
  errors: {
    unknown:
      'Encastra refused this for a reason this version has no words for ({kind}). Nothing was changed.',
    runtimeBusy: 'The runtime is busy with something else. Try that again in a moment.',
    libraryBusy: 'Your library is busy. Try that again in a moment.',
    importInFlight: 'An import is being written. The window will close once it has finished.',
    chooserDidNotReturn: 'The folder chooser closed without answering. Nothing was chosen.',
    notAFolderOnThisMachine: 'What the chooser gave back is not a folder on this machine.',
    notAFileOnThisMachine: 'That is not a file on this machine.',
    fileUnusable: 'That file cannot be used: {reason}.',
    folderUnusable: 'That folder cannot be used ({reason}).',
    notAProject: 'That is not an Encastra project. A project’s name ends in .encastra.',
    versionNotInProject:
      'That version is not in this project. Its history may have changed since you last looked at it.',
    versionsNotInProject:
      'One of those two versions is not in this project, so there is nothing to compare.',
    grantsRefused: 'Nothing ran. {count} of the permissions you allowed could not be given:',
    workingFolder:
      'Encastra could not prepare a working folder for this run ({reason}). Nothing ran.',
    inputUnreadable: '{path} could not be opened ({reason}). Nothing ran.',
    inputUnusable: 'The file for {node}.{port} cannot be used: {reason}. Nothing ran.',
    inputNotChosen:
      'Choose the file for {node}.{port} with the Choose button before running. Nothing ran.',
    workflowAlreadyRunning: 'A workflow is already running. Stop it before starting another.',
    workflowInvalid: 'This workflow cannot run yet: {problems} thing(s) to fix first.',
    workflowNotStarted: 'The workflow could not be started ({reason}). Nothing ran.',
    destinationMissing: 'That folder is not there. Choose one that exists.',
    destinationIsALink:
      'That folder is a link to somewhere else, so what was written would land somewhere other than where you chose. Pick the folder itself.',
    destinationIsAFile: 'That is a file, not a folder. A publication needs a folder of its own.',
    destinationNotChosen:
      'Choose the folder to publish into with the Choose button first, so that where Encastra writes is where you pointed.',
    publicationPathEscapes:
      'That publication cannot be written where it was asked to go. Nothing was written.',
    publicationAlreadyThere:
      '{folder} already holds a publication. Delete it, or choose another folder.',
    notOursToDelete:
      'That file is yours, and it stays where it is. Encastra only deletes copies it made itself, which means things you imported.',
    copyNotDeleted: 'It is off your list, but the copy could not be deleted ({reason}).',
    noWindow: 'There is no window to close.',
    windowWouldNotClose: 'The window would not close. Your work is still here.',
    io: 'Something on this computer refused the operation ({reason}).',
    // What the status bar is told while a workflow runs. `nothing-ran` is not here: it reuses
    // `messages.nothingRanProblems`, which said exactly this before the tag existed.
    status: {
      triggerError: '{node} stopped watching for changes. {reason}',
      eventsDropped: {
        one: '{count} event was dropped — they arrived faster than they could be handled.',
        other: '{count} events were dropped — they arrived faster than they could be handled.',
      },
      workflowStopped: 'This workflow stopped unexpectedly. You can start it again.',
      runningFor: {
        one: 'Running for {seconds} second.',
        other: 'Running for {seconds} seconds.',
      },
    },
    // Why a step of a run failed, in the reader's language.
    //
    // `NodeErrorCode` in `crates/encastra-core/src/journal.rs` is the pinned list these
    // are keyed by, and `errors.ts` camel-cases a code into one of the keys below. Before
    // this existed the run journal's own sentence was shown as the runtime had built it,
    // which meant the Run panel was English whatever language the rest of the window was.
    // Each sentence says what happened and what to do about it, because the runtime's
    // English `hint` is not shown once a code is recognised.
    node: {
      missingInput: 'Something this step needs is not connected. Connect a step that produces it.',
      wrongInput:
        'This step received a kind of value it cannot work with. Check what is connected to it.',
      missingConfig:
        'Something this step has to be told is not set. Fill it in on the step itself.',
      missingHandle:
        'The value this step was given is no longer available. Run the workflow again.',
      notText:
        'That file is not text this build can read. Connect it to a step that works with bytes instead.',
      notAnImage:
        'That file could not be read as an image. Check that what is connected really is one.',
      conversionFailed:
        'A value could not be turned into what the next step expects. Connect kinds that match, or add a step that converts them.',
      conversionUnavailable:
        'This build cannot yet make that conversion. It needs a component that has not shipped.',
      invalidJson: 'That text is not valid JSON, so there is nothing to read from it.',
      invalidCsv:
        'That file could not be read as a table. A row or the header does not follow the separator this step was given.',
      badSeparator: 'The separator has to be one character, such as a comma, a semicolon or a tab.',
      csvTooLarge:
        'That table has more rows or cells than this build turns into data. Split the file, or filter it before this step.',
      encodeFailed: 'The result could not be written out in the format this step produces.',
      resizeFailed:
        'That image could not be resized. It may be damaged, or larger than this build can work with.',
      unsupportedFormat: 'This build cannot write that image format. Choose PNG, JPEG or WebP.',
      badUrl:
        'That address cannot be used. It should look like https://example.com/path, with no user name or password in it.',
      insecureUrl:
        'That address uses plain http, which can be read and changed in transit. Use https, or turn on “Allow plain http” if you know the address is safe.',
      unsupportedMethod: 'This step does not send that kind of request.',
      requestFailed:
        'The request did not get through. Check the address, and that this machine can reach it.',
      responseTooLarge:
        'The answer was larger than this build reads. Responses above 16 MB are refused.',
      denied:
        'This step asked for something it was not allowed to do. Grant it in the permissions for this step, then run again.',
      readFailed:
        'Something on this computer refused to be read. It may have been moved, or this machine may not allow it.',
      writeFailed:
        'The result could not be written to this computer. Check that the folder is there and that you can write into it.',
      moveIncomplete:
        'The file was copied, but the original could not be removed. The destination now has a copy; remove the original yourself if you meant to move it.',
      tooLarge:
        'That file is larger than this build reads. Nothing was read. Use a smaller file, or split it before this step.',
      clipboardUnavailable:
        'There is no clipboard to use here. This happens on a machine with no desktop session, such as a build server.',
      clipboardFailed:
        'The clipboard would not take what this step tried to put on it. Nothing was copied.',
      cancelled: 'This step was stopped before it finished.',
      runTooLong:
        'The run passed the time limit and was stopped. What had finished by then is in the journal.',
      runMemoryBudget:
        'This step would take the run past what it may hold at once, so it was refused. Work through files one at a time, or pass them along as they are instead of reading them into text.',
      componentMissing:
        'The component this step uses is not installed. Import it, or remove the step.',
      noImplementation:
        'That component describes itself but has no code in this build. Sandboxed components are not runnable yet.',
      contractBroken:
        'The component produced something other than what it declares, so the result was not passed on.',
    },
    grant: {
      folderUnusable: '{node}: that folder cannot be used ({reason}).',
      folderNotChosen:
        '{node}: choose that folder with the Choose button before allowing it, so that what is allowed is what you pointed at.',
      notDeclared: '{node}: this step never asks for {capability}, so there is nothing to allow.',
    },
    project: {
      generic: 'That project file could not be read.',
      unsupportedSchema:
        'This build reads project files of version {ours}, and that one says it is version {theirs}. It was made by a newer Encastra.',
      missingEntry: 'The project file holds no {entry}, so it is not a whole project.',
      invalid: '{entry} inside that project is not valid: {reason}.',
      archive: 'The project file could not be read as an archive ({reason}). It may be damaged.',
      tooLarge:
        '{entry} inside that project unpacks to more than this build will read ({limit} bytes).',
      tooLargeInTotal:
        'That project unpacks to more than this build will read ({limit} bytes in all).',
      tooManySnapshots:
        'That project keeps {count} versions, and this build holds at most {limit}.',
      fileTooLarge: 'That project file is {size} bytes, and this build reads at most {limit}.',
      ambiguousArchive:
        'The project archive lists {declared} entries under only {distinct} names, so it names something twice. Encastra will not guess which one was meant.',
      io: 'The project file could not be read or written ({reason}).',
    },
    library: {
      generic: 'Your library could not be read.',
      corrupt:
        'Your library index could not be read ({reason}). It has been left exactly as it is: it is your record of your own work, and Encastra does not start it over.',
      writtenByAnotherVersion:
        'Your library index was written by another version of Encastra (it says version {theirs}, and this build reads {ours}). It has been left as it is.',
      tooManyEntries:
        'Your library index lists {count} things, and this build holds at most {max}. It has been left as it is.',
      notOurs:
        'That is not something Encastra put there, so it is not something Encastra will remove.',
      io: 'Your library could not be read or written ({reason}).',
    },
    bundle: {
      generic: 'That publication could not be prepared.',
      reviewRefused:
        'The check found {blocking} thing(s) that would have to change before this could be published.',
      notAVersion: '“{version}” is not a version. Publications are numbered like 1.2.0.',
      notYourNamespace:
        '“{listing}” is not inside {publisher}’s namespace. A publication is filed under the name of whoever publishes it.',
      missing: 'A publication needs a {field}.',
      tooLong: 'The {field} is longer than this build will publish (at most {max} characters).',
      controlCharacters:
        'The {field} holds characters that can hide what it really says. Encastra refuses it rather than quietly rewriting what you wrote.',
      tooLarge: 'That project is about {size}, and this build publishes at most {max}.',
      notInstallable: 'This build cannot install a {publicationKind}, so it will not offer one.',
      notAnIdentifier: '“{value}” is not a usable name: {why}.',
    },
    import: {
      generic: 'That publication was not taken in, and nothing on this machine was changed.',
    },
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
          label: 'Not translated',
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
          connectFromStep: 'Start a connection from the selected step, on the canvas',
          cycleConnections: 'Move through the connections of the selected step, on the canvas',
          deleteConnection: 'Delete the connection being held, on the canvas',
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
          confirm: {
            question:
              'Reset every setting on this screen? Your projects, grants and installed components are not touched.',
            confirm: 'Yes, reset them',
            cancel: 'Cancel',
          },
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
          failed: 'The report could not be saved. Use Copy instead.',
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
