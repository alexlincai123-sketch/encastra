/**
 * Deutsch. Jeder Schlüssel hier muss auch auf Englisch existieren — das prüft `i18n.test.ts`.
 * Ein fehlender Schlüssel fällt einfach auf Englisch zurück; eine unsichere Übersetzung wird
 * nicht aufgenommen.
 */

import type { Messages } from '../index';

const de: Messages = {
  common: {
    close: 'Schließen',
    dismiss: 'Verwerfen',
    choose: 'Auswählen…',
    itCannot: 'Sie kann nicht',
    recordingBadge: 'Aufzeichnung',
  },

  sidebar: {
    ariaLabel: 'Bereiche',
    running: ', läuft',
    items: {
      home: 'Start',
      builder: 'Builder',
      library: 'Bibliothek',
      components: 'Komponenten',
      security: 'Sicherheit',
      settings: 'Einstellungen',
    },
  },

  home: {
    intro: {
      heading: 'Software aus Teilen bauen, die zusammenpassen.',
      body: 'Komponenten auf eine Fläche setzen, verbinden und starten. Alles läuft auf diesem Rechner, und nichts greift auf Ihre Dateien zu, ohne vorher zu fragen.',
    },
    actions: {
      new: {
        title: 'Neuer Workflow',
        detail: 'Mit einer leeren Fläche beginnen',
      },
      open: {
        title: 'Öffnen',
        detailReady: 'Eine zuvor gespeicherte .encastra-Datei',
        detailUnavailable: 'Erfordert die Desktop-Anwendung',
      },
      library: {
        title: 'Aus Ihrer Bibliothek öffnen',
        detail: 'Was Sie gebaut, übernommen oder vorbereitet haben',
      },
      browse: {
        title: 'Komponenten durchsuchen',
        detail: {
          one: '{count} installiert, und was sie erreichen kann',
          other: '{count} installiert, und was jede davon erreichen kann',
        },
      },
    },
    continue: {
      heading: 'Wo Sie aufgehört haben',
      steps: {
        one: '{count} Schritt',
        other: '{count} Schritte',
      },
      unsaved: ' · noch nicht gespeichert',
    },
    samples: {
      heading: 'Beispiele',
      note: 'Echte Workflows auf der echten Laufzeitumgebung. Jedes braucht von Ihnen gewählte Ordner, bevor es starten kann — ein Beispiel, das irgendwohin schreibt, das Sie nicht gewählt haben, wäre genau das Gegenteil des Sinns.',
      needs: 'Benötigt: {list}',
    },
  },

  palette: {
    title: 'Komponenten',
    empty: 'Es sind keine Komponenten installiert.',
    asksTo: 'Fragt nach: {list}',
    capabilities: {
      fsRead: 'liest Dateien',
      fsWrite: 'schreibt Dateien',
      netHttp: 'nutzt das Netzwerk',
      systemNotify: 'zeigt Benachrichtigungen',
      systemClipboard: 'nutzt die Zwischenablage',
    },
  },

  canvas: {
    ariaLabel: 'Workflow-Fläche',
    refusal: {
      selfCycle: {
        headline: 'Ein Schritt kann sich nicht selbst versorgen.',
        detail:
          'Ein Workflow läuft vorwärts. Um dieselbe Arbeit wiederholt auszuführen, starten Sie ihn über einen Auslöser — Ordner überwachen oder Timer —, der ihn einmal pro Ereignis ausführt.',
      },
      bridge: 'Ein Schritt, der dazwischen {bridge} erzeugt, würde die beiden verbinden.',
      // Jede Formulierung, aus der eine Ablehnung besteht — siehe `canvas/refusal.ts`.
      cannotFeed:
        'Ein Wert vom Typ {from} passt nicht in einen Schritt, der einen Wert vom Typ {to} erwartet.',
      rawType: '„{name}“',
      listOf: 'Liste von Werten vom Typ {item}',
      optional: 'optionaler Wert vom Typ {item}',
      types: {
        bool: 'Wahrheitswert',
        i64: 'ganze Zahl',
        f64: 'Zahl',
        string: 'Text',
        json: 'JSON',
        file: 'Datei',
        dir: 'Ordner',
        bytes: 'Bytes',
        image: 'Bild',
        video: 'Video',
        audio: 'Ton',
      },
      nouns: {
        bool: 'Wahrheitswert',
        i64: 'ganze Zahl',
        f64: 'Zahl',
        string: 'Text',
        json: 'JSON',
        file: 'Datei',
        dir: 'Ordner',
        bytes: 'Bytes',
        image: 'Bild',
        video: 'Video',
        audio: 'Ton',
      },
      labels: {
        bool: 'Wahrheitswert',
        i64: 'Ganzzahl',
        f64: 'Zahl',
        string: 'Text',
        json: 'JSON',
        file: 'Datei',
        dir: 'Ordner',
        bytes: 'Bytes',
        image: 'Bild',
        video: 'Video',
        audio: 'Ton',
      },
      detail: {
        notAType: '„{name}“ kann diese Version nicht als Typ lesen.',
        listsDoNotMatch: 'Die beiden Listen enthalten nicht dasselbe. {inner}',
        cannotConnect: '{from} und {to} lassen sich nicht verbinden.',
        unknownType:
          '„{name}“ ist kein Typ, den diese Laufzeitumgebung kennt. Die Komponente braucht vielleicht eine neuere Version.',
        siblings:
          '{from} und {to} sind beides Arten von {shared}, aber das eine ist nicht das andere. Wandeln Sie über {shared} um, wenn Sie das meinen.',
        noConversion: 'Zwischen {from} und {to} gibt es keine Umwandlung.',
      },
    },
    empty: {
      heading: 'Ihre Fläche ist leer',
      body: 'Ein Workflow besteht aus wenigen miteinander verbundenen Komponenten. Wählen Sie links eine aus, um Ihren ersten Schritt zu platzieren, verbinden Sie seine Ausgabe mit dem nächsten und drücken Sie Ausführen.',
      hint: 'Jede Komponente nennt vorher, worauf sie zugreifen kann, und nichts berührt Ihre Dateien, bevor Sie es erlauben.',
    },
    // The menu a right-click opens on the canvas. Removing a step was always possible from
    // the keyboard; this is where somebody finds out that it is.
    menu: {
      label: 'Aktionen der Arbeitsfläche',
      connect: 'Von hier aus verbinden…',
      duplicate: 'Duplizieren',
      disable: 'Ausschalten',
      enable: 'Einschalten',
      deleteStep: 'Schritt löschen',
      deleteConnection: 'Verbindung löschen',
      paste: 'Einfügen',
      selectAll: 'Alles auswählen',
      undo: 'Rückgängig',
      redo: 'Wiederholen',
      many: {
        duplicate: {
          one: '{count} Schritt duplizieren',
          other: '{count} Schritte duplizieren',
        },
        disable: {
          one: '{count} Schritt ausschalten',
          other: '{count} Schritte ausschalten',
        },
        enable: {
          one: '{count} Schritt einschalten',
          other: '{count} Schritte einschalten',
        },
        delete: {
          one: '{count} Schritt löschen',
          other: '{count} Schritte löschen',
        },
      },
    },
    keysHint:
      'Mit den Pfeiltasten zwischen Schritten bewegen, mit Eingabe einen Schritt im Inspektor öffnen, mit C eine Verbindung vom ausgewählten Schritt aus beginnen, mit E durch dessen bestehende Verbindungen gehen, mit Entf das Ausgewählte entfernen und mit Escape loslassen.',
    connect: {
      started:
        'Verbindung von {from}. {targets}. Pfeiltasten zum Auswählen, Eingabe zum Verbinden, Escape zum Abbrechen.',
      targets: {
        one: '{count} mögliches Ziel',
        other: '{count} mögliche Ziele',
      },
      connected: 'Verbunden.',
      cancelled: 'Abgebrochen.',
      noTargets: 'Nichts auf dieser Arbeitsfläche kann aufnehmen, was {step} erzeugt.',
      noOutputs: '{step} erzeugt nichts, von dem aus verbunden werden könnte.',
    },
    connection: {
      focused: 'Verbindung von {from} nach {to}.',
      removed: 'Verbindung entfernt.',
      none: '{step} hat noch keine Verbindungen.',
    },
    a11y: {
      selected: '{name}, Schritt {index} von {total}, ausgewählt.',
      port: '{step} · {port}',
    },
    node: {
      notInstalled: 'Nicht installiert.',
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
    wire: {
      ops: {
        toText: 'als Text',
        intToFloat: 'als Dezimalzahl',
        boolToInt: 'als Zahl',
        intToBool: 'als Ja/Nein',
        round: 'gerundet',
        parseInt: 'Zahl einlesen',
        parseFloat: 'Dezimalzahl einlesen',
        parseBool: 'Ja/Nein einlesen',
        parseJson: 'JSON einlesen',
        stringifyJson: 'als Text',
        encodeJson: 'zu JSON',
        decodeJson: 'aus JSON',
        readBytes: 'lesen',
        writeTemp: 'in Datei',
        unwrapOption: 'kann fehlen',
        map: 'jeweils',
      },
    },
  },

  publish: {
    heading: 'Eine Veröffentlichung vorbereiten',
    intro:
      'Encastra liest das gespeicherte Projekt so, wie es jemand läse, der es erhält, und schreibt es dann in einen Ordner Ihrer Wahl — zusammen mit dem Dokument, das es begleiten würde. Nichts wird hochgeladen: Es gibt keine Registry, an die es ginge, und kein Konto, mit dem es ginge.',
    saveFirst:
      'Speichern Sie das Projekt zuerst. Veröffentlicht wird die Datei, und die gibt es noch nicht.',
    saveChangesFirst:
      'Speichern Sie Ihre Änderungen zuerst. Veröffentlicht wird die Datei auf der Festplatte, und sie stimmt nicht mehr mit der Arbeitsfläche überein.',
    sections: {
      about: 'Was das ist',
      check: 'Was Encastra gefunden hat',
      done: 'Wohin es geschrieben wurde',
    },
    fields: {
      title: {
        label: 'Name',
        hint: 'Wie es auf der Seite heißt, auf der sich jemand entscheidet.',
      },
      summary: {
        label: 'Zusammenfassung',
        hint: 'Ein oder zwei Sätze: was es tut und für wen.',
      },
      namespace: {
        label: 'Ihr Namensraum',
        hint: 'Ein umgekehrter Domainname, den Sie kontrollieren, etwa dev.ihrname. Niemand hat das geprüft — es gibt keine Konten —, es ist also eine Behauptung, kein Nachweis.',
      },
      version: {
        label: 'Version',
        hint: 'Nummeriert wie 1.0.0. Eine veröffentlichte Version ändert sich nie; eine Änderung bekommt eine neue Nummer.',
      },
      kind: {
        label: 'Art',
        hint: 'Ein Projekt ist zum Ausführen gedacht. Eine Vorlage zum Auseinandernehmen und Ändern.',
      },
      licence: {
        label: 'Lizenz',
        hint: 'Was jemand anderes damit tun darf. Ein Teil, dessen Lizenz dieser widerspricht, wird abgelehnt.',
      },
    },
    kinds: {
      project: 'Projekt',
      template: 'Vorlage',
    },
    licences: {
      mit: 'MIT',
      'apache-2.0': 'Apache-2.0',
      'gpl-3.0-only': 'GPL-3.0-only',
      proprietary: 'Alle Rechte vorbehalten',
    },
    derivedName: 'Es wäre bekannt als',
    freeOnly:
      'Kostenlos, und nur kostenlos. Es gibt keinen Zahlungsanbieter und kein Konto, dem etwas berechnet würde — ein Preis hier wäre eine Zahl, die niemand einziehen könnte.',
    checking: 'Projekt wird gelesen…',
    checkAgain: 'Erneut prüfen',
    prepare: 'Vorbereiten…',
    nothingFound: 'Nichts hier würde eine Veröffentlichung verhindern.',
    notAnAudit:
      'Dies findet die Fehler, die mechanisch genug sind, um gefunden zu werden. Es ist keine Sicherheitsprüfung, und niemand hat eine durchgeführt.',
    capabilities: {
      none: 'Es verlangt nichts außerhalb seiner selbst.',
      some: 'Wer dies installiert, wird bei jeder Ausführung gefragt, bevor es Folgendes nutzen darf:',
    },
    preparedInto: 'Das Projekt und sein Veröffentlichungsdokument liegen hier:',
    nowhereToSend: 'Sie bleiben auf diesem Rechner. Es gibt noch nirgendwo hin, wohin sie gingen.',
    problems: {
      namespaceMissing: 'Eine Veröffentlichung braucht einen Namensraum.',
      namespaceShape: 'Ein Namensraum ist ein umgekehrter Domainname, etwa dev.ihrname.',
      titleMissing: 'Eine Veröffentlichung braucht einen Namen.',
      titleUnusable:
        'Dieser Name enthält weder Buchstaben noch Ziffern, aus denen sich eine Kennung bilden ließe.',
      summaryMissing: 'Eine Veröffentlichung braucht eine Zusammenfassung.',
      summaryShort:
        'Ein paar Wörter sagen jemandem, der sich entscheidet, nichts. Sagen Sie, was es tut.',
      versionShape: 'Eine Version wird wie 1.0.0 nummeriert.',
    },
  },
  library: {
    preparedNotOpenable:
      'Eine vorbereitete Veröffentlichung ist ein Ordner zum Weitergeben, kein Projekt zum Öffnen. Öffnen Sie stattdessen das Projekt, aus dem sie entstanden ist.',
    heading: 'Ihre Bibliothek',
    intro:
      'Alles, was Sie haben: die Projekte, die Sie gebaut haben, was Sie von jemandem übernommen haben, und die Ordner, die Sie zum Weitergeben vorbereitet haben. Alles liegt auf diesem Rechner. Nichts wird synchronisiert, hochgeladen oder geteilt.',
    import: 'Importieren…',
    importTitle: 'Einen Veröffentlichungsordner lesen, den Ihnen jemand gegeben hat',
    importUnavailable: 'Erfordert die Desktop-Anwendung',
    search: {
      placeholder: 'Suchen',
      ariaLabel: 'In Ihrer Bibliothek suchen',
    },
    sort: {
      label: 'Reihenfolge',
      name: 'Nach Name',
      recent: 'Zuletzt benutzt',
      origin: 'Nach Herkunft',
    },
    noMatches: 'Hier passt nichts dazu.',
    quarantined:
      'Die bisherige Liste war nicht lesbar. Sie wurde als {name} beiseitegelegt und eine neue begonnen. Gelöscht wurde nichts, und keines Ihrer Projekte wurde angerührt.',
    origin: {
      created: 'Hier gebaut',
      imported: 'Importiert',
      prepared: 'Vorbereitet',
    },
    status: {
      missing: {
        label: 'Nicht da',
        detail:
          'An der genannten Stelle liegt nichts mehr. Die Datei wurde außerhalb von Encastra verschoben oder gelöscht — das dürfen Sie. Dieser Eintrag ist veraltet, nicht falsch.',
      },
      changed: {
        label: 'Geändert',
        detail:
          'Die Datei ist da, ihr Inhalt weicht aber von dem ab, was Encastra zuletzt gesehen hat. Etwas hat sie anderswo bearbeitet.',
      },
    },
    facts: {
      version: 'Version',
      publisher: 'Herausgeber',
      steps: 'Schritte',
      when: 'Zuletzt',
    },
    row: {
      opened: 'Geöffnet am {when}',
      added: 'Hinzugefügt am {when}',
      publisherClaim:
        '{publisher} — behauptet, nicht geprüft. Es gibt keine Konten, also hat das niemand nachgesehen.',
      steps: {
        one: '{count} Schritt',
        other: '{count} Schritte',
      },
    },
    reach: {
      none: 'Es fordert nichts außerhalb seiner selbst an.',
      someLabel: 'Es wird um Zugriff bitten auf:',
      asksEveryRun: 'Dass es hier liegt, gewährt davon nichts. Jeder Lauf fragt erneut.',
    },
    actions: {
      open: 'Öffnen',
      remove: 'Entfernen…',
    },
    remove: {
      cancel: 'Behalten',
      keepsFile:
        'Das nimmt es nur von der Liste. Ihre Datei bleibt genau dort, wo Sie sie abgelegt haben.',
      forget: 'Von der Liste nehmen',
      importedNote:
        'Diese Kopie hat Encastra angelegt, also darf sie auch gelöscht werden. Sie entscheiden: die Kopie geht, oder sie bleibt liegen.',
      andDeleteCopy: 'Entfernen und Kopie löschen',
      keepCopy: 'Entfernen, Kopie behalten',
      refused:
        'Diese Datei gehört Ihnen und bleibt, wo sie ist. Encastra löscht nur Kopien, die sie selbst angelegt hat.',
    },
    empty: {
      heading: 'Hier ist noch nichts',
      body: 'Drei Dinge landen auf dieser Liste, und jedes beginnt mit etwas, das Sie tun.',
      ways: {
        created: 'Ein Projekt, das Sie speichern, wird aufgenommen.',
        imported:
          'Ein Veröffentlichungsordner, den Ihnen jemand gegeben hat, kommt dazu, wenn Sie ihn importieren — nachdem Encastra ihn gelesen hat und Sie zugestimmt haben.',
        prepared: 'Ein Ordner, den Sie zum Weitergeben vorbereiten, kommt beim Vorbereiten dazu.',
      },
      build: 'Etwas bauen',
      buildTitle: 'Den Builder öffnen und mit einer leeren Fläche anfangen',
    },
  },

  import: {
    heading: 'Eine Veröffentlichung übernehmen',
    intro:
      'Encastra hat den gewählten Ordner so gelesen, wie ihn ein Empfänger lesen sollte: die Datei gegen das Dokument daneben geprüft und die Prüfung des Herausgebers hier noch einmal ausgeführt. Geschrieben wurde nichts, ausgeführt auch nichts.',
    reading: 'Der Ordner wird gelesen…',
    confirm: 'Importieren',
    nothing: 'nichts',
    copiesNothingRuns:
      'Importieren kopiert die Dateien in Ihre Bibliothek. Es läuft nichts, bis Sie es öffnen und auf Ausführen drücken.',
    nothingWasTakenIn: 'Es wurde nichts übernommen und auf diesem Rechner nichts verändert.',
    sections: {
      what: 'Was es zu sein behauptet',
      integrity: 'Ob die Datei die beschriebene ist',
      inside: 'Was darin steckt',
      asks: 'Worum es bitten würde',
      check: 'Was Encastra gefunden hat',
    },
    facts: {
      publisher: 'Herausgeber',
      name: 'Bekannt als',
      version: 'Version',
      kind: 'Art',
      licence: 'Lizenz',
      size: 'Größe',
      kilobytes: '{size} kB',
      runtime: 'Läuft auf',
      projectName: 'Projekt',
      steps: 'Schritte',
      stepCount: {
        one: '{count} Schritt',
        other: '{count} Schritte',
      },
      switchedOff: ' ({count} abgeschaltet)',
      versions: 'Aufbewahrte Versionen',
      versionCount: {
        one: '{count} Version',
        other: '{count} Versionen',
      },
    },
    kinds: {
      project: 'Projekt',
      template: 'Vorlage',
      component: 'Komponente',
    },
    notVerified:
      'Niemand hat geprüft, ob dieser Herausgeber der ist, den der Name nennt. Es gibt keine Konten, also hätte es auch niemand tun können.',
    checksumMatches: 'Die Datei stimmt mit der Prüfsumme im Dokument daneben überein.',
    checksumIsNotProvenance:
      'Das belegt, dass die Datei seit der Vorbereitung nicht verändert wurde. Über den Urheber sagt es nichts.',
    capabilities: {
      none: 'Es fordert nichts außerhalb seiner selbst an.',
      some: 'Beim Ausführen bittet es um die Nutzung von:',
      grantsNothing:
        'Der Import gewährt davon nichts. Jeder Lauf fragt, bevor irgendetwas erreicht wird.',
    },
    nothingFound: 'Hier spricht nichts dagegen, das zu übernehmen.',
    notAnAudit:
      'Das findet die Fehler, die mechanisch genug sind, um gefunden zu werden. Es ist kein Sicherheitsaudit, und niemand hat eines durchgeführt.',
    disagreement: {
      declared: 'Das Dokument sagt',
      actual: 'Das Projekt verlangt',
    },
    tokens: {
      title: 'Titel',
      summary: 'Zusammenfassung',
      changelog: 'Änderungsliste',
      publisher: 'Herausgeber',
      categories: 'Kategorien',
      tags: 'Schlagwörter',
      runtime: 'Laufzeit',
    },
    errors: {
      notAFolder:
        'Das ist kein Ordner. Eine Veröffentlichung ist ein Ordner mit einem Projekt und dem Dokument, das es beschreibt.',
      folderIsALink:
        'Dieser Ordner ist eine Verknüpfung woandershin. Encastra folgt ihr nicht, denn dann wären das Gelesene und das Gewählte nicht dasselbe. Wählen Sie den Ordner selbst.',
      folderNotChosen:
        'Dieser Ordner wurde in dieser Sitzung nicht ausgewählt. Wählen Sie ihn über die Ordnerauswahl, damit Encastra genau das liest, worauf Sie gezeigt haben.',
      noDocument:
        'In diesem Ordner gibt es keine publication.json, also sagt nichts darin, was es ist. Das ist ein Ordner voller Dateien, keine Veröffentlichung.',
      documentIsALink:
        'publication.json ist eine Verknüpfung auf eine andere Datei, keine Datei. Encastra liest, was im gewählten Ordner liegt, und nichts außerhalb davon.',
      documentTooLarge:
        'publication.json ist etwa {size} kB groß, und dieser Build liest höchstens {max} kB. Ein Veröffentlichungsdokument ist eine Seite Text; so groß ist keines.',
      documentUnreadable:
        'publication.json konnte nicht gelesen werden: {reason}. Bitten Sie die Person, die es vorbereitet hat, es erneut vorzubereiten.',
      noProject:
        'In diesem Ordner liegt keine .encastra-Datei. Eine Veröffentlichung besteht aus einem Projekt und dem Dokument dazu.',
      moreThanOneProject:
        'Eine Veröffentlichung ist ein Projekt, dieser Ordner enthält {count}: {names}. Wer ihn vorbereitet hat, sollte einen Ordner pro Projekt schicken.',
      projectIsALink:
        'Die Projektdatei ist eine Verknüpfung auf eine andere Datei, keine Datei. Encastra installiert, was im gewählten Ordner liegt, und nichts außerhalb davon.',
      unexpectedEntries:
        'Ein Veröffentlichungsordner enthält ein Dokument und ein Projekt, sonst nichts. Dieser enthält außerdem {names}. Encastra übernimmt keinen Ordner, für den es nicht geradestehen kann.',
      tooManyEntries:
        'Ein Veröffentlichungsordner enthält ein Dokument und ein Projekt, sonst nichts. Dieser enthält mehr als {max} Einträge, und das ist keine Veröffentlichung, was auch immer sie sind.',
      projectTooLarge:
        'Das Projekt ist etwa {size} kB groß, und dieser Build installiert höchstens {max} kB.',
      checksumMismatch:
        'Die Projektdatei ist nicht die, die diese Veröffentlichung beschreibt. Entweder beschreibt das Dokument eine andere Datei, oder die Datei hat sich unterwegs geändert. Fordern Sie sie erneut an.',
      projectUnreadable:
        'Die Projektdatei konnte nicht gelesen werden: {reason}. Möglicherweise stammt sie aus einer neueren Encastra-Version oder wurde unterwegs beschädigt.',
      notInstallable:
        'Dieser Build kann kein {publicationKind} installieren und wird es auch nicht vortäuschen.',
      notAListingId:
        '„{id}“ ist kein Veröffentlichungsname, also gibt es keinen sicheren Namen, unter dem das abgelegt werden könnte.',
      notAVersion: '„{version}“ ist keine Version. Veröffentlichungen werden wie 1.2.0 nummeriert.',
      notPublishersNamespace:
        '„{listing}“ liegt nicht im Namensraum von {publisher}. Das Dokument nennt einen Herausgeber und eine Veröffentlichung, die einem anderen gehört, und Encastra kann nicht wissen, welches von beiden der Fehler ist.',
      textTooLong:
        'Der Eintrag {field} ist länger, als dieser Build liest (höchstens {max} Zeichen).',
      textHasControlCharacters:
        'Der Eintrag {field} enthält Zeichen, die verbergen können, was dort wirklich steht — solche, die einen Namen wie einen anderen aussehen lassen. Encastra lehnt ihn ab, statt still umzuschreiben, was jemand geschrieben hat.',
      documentDisagreesWithProject:
        'Dokument und Projekt widersprechen sich beim Punkt {about}. Die Seite, die das beschreibt, beschreibt etwas anderes als die Datei daneben.',
      runtimeIncompatible:
        'Diese Veröffentlichung ist für eine Laufzeit {requires} gedacht, hier läuft {have}. Für eine Version, für die es nicht gebaut wurde, wird nichts installiert.',
      reviewRefused:
        'Dieselbe Prüfung, die sein Herausgeber ausgeführt hat, lehnt es hier ab. Das müsste sich ändern, bevor es jemand übernehmen könnte:',
      capabilitiesDisagree:
        'Dokument und Projekt sind sich nicht einig darüber, worum das bittet. Zu wenige Berechtigungen anzugeben ist das offensichtliche Problem; zu viele anzugeben bringt Leute dazu, die Liste zu überfliegen — das subtilere. Beides wird abgelehnt.',
      alreadyImported:
        '{listing} {version} liegt bereits in Ihrer Bibliothek. Eine veröffentlichte Version ändert sich nie, es gibt hier also nichts Neues zu übernehmen.',
      io: 'Etwas auf diesem Rechner hat den Vorgang verweigert ({reason}). Übernommen wurde nichts.',
      unknown:
        'Encastra hat diesen Ordner aus einem Grund abgelehnt, für den diese Version keine Worte hat. Übernommen wurde er nicht.',
    },
  },

  toolbar: {
    publish: 'Veröffentlichen',
    publishTitle: 'Dieses Projekt vorbereiten, damit jemand anderes es installieren kann',
    preview: {
      badge: 'Vorschau',
      title: 'Mit diesem Fenster ist keine Laufzeitumgebung verbunden.',
    },
    new: 'Neu',
    open: 'Öffnen',
    save: 'Speichern',
    unsavedChanges: 'Nicht gespeicherte Änderungen',
    check: 'Prüfen',
    stop: 'Stoppen',
    run: 'Ausführen',
    startWatching: 'Überwachung starten',
    watching: 'Überwacht',
    recordedRuns: {
      everythingAllowed: 'Aufgezeichnet: alles erlaubt',
      folderNotAllowed: 'Aufgezeichnet: der Ordner wurde nicht erlaubt',
    },
    notifications: {
      more: '{count} weitere',
    },
    status: {
      steps: {
        one: '{count} Schritt',
        other: '{count} Schritte',
      },
      running: 'wird ausgeführt',
      runs: {
        one: '{count} Ausführung',
        other: '{count} Ausführungen',
      },
      waiting: '{count} wartend',
      ok: {
        one: '{count} erfolgreich',
        other: '{count} erfolgreich',
      },
      failed: {
        one: '{count} fehlgeschlagen',
        other: '{count} fehlgeschlagen',
      },
      skipped: {
        one: '{count} übersprungen',
        other: '{count} übersprungen',
      },
    },
  },

  components: {
    header: {
      title: 'Komponenten',
      summary: '{count} installiert.',
      summaryWithTriggers:
        '{count} installiert — {triggerCount} davon starten selbst einen Workflow; der Rest läuft als Schritt innerhalb eines Workflows.',
      note: 'Alles hier ist Teil der Anwendung; um andere zu installieren, wird die Sandbox für Drittanbieter-Code benötigt, die noch nicht gebaut ist.',
    },
    search: {
      placeholder: 'Suchen',
      ariaLabel: 'Komponenten durchsuchen',
    },
    filters: {
      categoryLegend: 'Kategorie',
    },
    empty: 'Nichts passt dazu.',
    card: {
      triggerBadge: 'startet einen Workflow',
      triggerNote:
        'Eine Ereignisquelle, kein Schritt — dies startet eine Ausführung, statt innerhalb einer zu laufen.',
      noDescription: 'Diese Komponente hat nicht dokumentiert, was sie tut.',
      takes: 'Nimmt',
      gives: 'Gibt',
      addToCanvas: 'Zur Fläche hinzufügen',
    },
    reach: {
      label: 'Zugriff auf',
      none: 'Greift auf nichts außerhalb dieses Workflows zu',
      verb: {
        fsRead: 'Liest Dateien',
        fsWrite: 'Schreibt Dateien',
        netHttp: 'Nutzt das Netzwerk',
        systemClipboard: 'Nutzt die Zwischenablage',
        systemNotify: 'Zeigt Benachrichtigungen',
      },
      cannot: {
        fsRead: 'Ihre Dateien lesen',
        fsWrite: 'Dateien schreiben',
        netHttp: 'das Netzwerk nutzen',
        systemClipboard: 'die Zwischenablage nutzen',
        systemNotify: 'Benachrichtigungen anzeigen',
      },
    },
  },

  security: {
    title: 'Sicherheit',
    intro:
      'Komponenten können nicht auf Ihre Dateien, Ihr Netzwerk oder Ihre Zwischenablage zugreifen, sofern ein Manifest es nicht deklariert und Sie es nicht erlauben. Berechtigungen werden pro Ausführung erteilt, und jede Anfrage — erlaubt oder abgelehnt — wird protokolliert und ist einsehbar.',
    installed: {
      title: 'Installierte Komponenten',
      headers: {
        component: 'Komponente',
        version: 'Version',
        origin: 'Herkunft',
        canReach: 'Zugriff auf',
      },
      builtIn: 'eingebaut',
      nothing: 'nichts',
      thirdPartyNote:
        'Nichts hier stammt von außerhalb dieser Anwendung. Drittanbieter-Komponenten würden in einer WebAssembly-Sandbox ohne Umgebungsrechte laufen; diese Sandbox ist entworfen und dokumentiert, aber {notBuilt}, daher ist es noch nicht möglich, sie zu installieren.',
      thirdPartyNoteEmphasis: 'nicht gebaut',
    },
    grants: {
      title: 'Im geöffneten Workflow erlaubt',
      empty:
        'Nichts wurde erlaubt. Ein Workflow, der einen Ordner braucht, fragt danach, bevor er läuft.',
      note: 'Diese gelten nur für diese Sitzung. Beim Schließen der Anwendung werden sie vergessen, sodass ein Workflow, den Sie seit einem Monat nicht angesehen haben, nicht mehr irgendwo schreiben kann.',
    },
    privacy: {
      title: 'Datenschutz',
      telemetry: {
        label: 'Telemetrie',
        value: 'Keine. Nichts wird gesammelt und nichts wird gesendet.',
      },
      crashReports: { label: 'Absturzberichte', value: 'Keine.' },
      accounts: { label: 'Konten', value: 'Keine. Es gibt weder Anmeldung noch Server.' },
      yourFiles: {
        label: 'Ihre Dateien',
        value:
          'Verlassen diesen Rechner nie, außer ein von Ihnen erstellter Workflow sendet sie irgendwohin.',
      },
      runJournals: {
        value:
          'Zeichnen Größen und Formen auf, niemals Dateiinhalte. Ein Protokoll wird im Speicher gehalten, solange das Fenster geöffnet und sichtbar ist; nichts wird auf die Festplatte geschrieben, und beim Schließen der Anwendung wird es verworfen.',
      },
    },
    limits: {
      title: 'Wovor dies nicht schützt',
      misuse:
        'Eine Komponente, der Sie weitreichenden Zugriff erlauben, kann ihn missbrauchen. Der Dialog kann das informiert machen; unmöglich machen kann er es nicht.',
      trustedBase:
        'Eingebaute Komponenten laufen als gewöhnlicher nativer Code. Sie werden vom Berechtigungs-Broker eingeschränkt, aber ein Fehler in einer davon ist ein Fehler in der vertrauenswürdigen Basis.',
      noAudit:
        'Diese Version wurde keinem externen Sicherheitsaudit unterzogen. Das ist Voraussetzung für die Verteilung von Komponenten, die andere geschrieben haben, nicht für die Ausführung Ihrer eigenen Workflows.',
      unsigned:
        'Nichts hier ist bisher signiert, daher kann diese Version nicht beweisen, dass sie nicht verändert wurde.',
      previewOnly: 'Dies ist eine Vorschau im Browser, ohne verbundene Laufzeitumgebung.',
    },
    footer:
      'Laufzeitumgebung {runtime} · Protokollschema {protocolSchema} · Projektschema {projectSchema}',
  },

  inspector: {
    problemsTitle: 'Probleme',
    projectTitle: 'Projekt',
    selectStep: 'Wählen Sie einen Schritt zum Konfigurieren, oder eine Komponente, um zu beginnen.',
    component: 'Komponente',
    switchOn: 'Einschalten',
    switchOff: 'Ausschalten',
    settingsTitle: 'Einstellungen',
    nothingChosen: 'Nichts ausgewählt',
    entryInputs: {
      title: 'Ausgangsmaterial',
      doc: 'Nichts im Graphen erzeugt dies, daher braucht die Ausführung es von Ihnen.',
    },
    permissions: {
      title: 'Berechtigungen',
      none: 'Diese Komponente verlangt nichts. Sie arbeitet nur mit dem, was der Graph ihr gibt, und kann weder auf Ihre Dateien noch auf das Netzwerk noch auf die Zwischenablage zugreifen.',
      allowed: 'Erlaubt',
      allowFolder: 'Diesen Ordner erlauben',
      allowHost: '{host} erlauben',
      allowAddress: 'Diese Adresse erlauben',
      allow: 'Erlauben',
      scope:
        'Erlaubt, solange dieses Projekt geöffnet ist. Jeder Lauf verwendet genau diesen Ordner oder diese Adresse; beim Schließen oder Wechseln des Projekts wird das wieder vergessen.',
      chooseFolderFirst: 'Wählen Sie zuerst einen Ordner.',
      enterAddressFirst: 'Geben Sie zuerst eine Adresse ein.',
      notASetting:
        'Keine Einstellung — die Komponente hat dies nie deklariert, daher lehnt die Laufzeitumgebung es ab, was auch immer Sie hier erlauben.',
    },
    versions: {
      title: 'Versionen',
      titleWithCount: 'Versionen · {count}',
      empty:
        'Speichern Sie dieses Projekt, um Versionen aufzubewahren. Jedes Speichern zeichnet eine auf, und nichts wird jemals überschrieben.',
      currentVersionTitle: 'Dies ist die aktuelle Version.',
      restoreTitle:
        'Diese wiederherstellen. Sie wird als neue Version hinzugefügt; nichts geht verloren.',
      current: 'Aktuell',
      versionNumber: 'Version {number}',
      restore: 'Wiederherstellen',
    },
    runRecord: {
      title: 'Letzte Ausführung',
      code: 'Code: {code}',
      neverRan: 'Dieser Schritt wurde nie ausgeführt, weil {name} nicht abgeschlossen wurde.',
      status: 'Status',
      took: 'Dauer',
      in: 'ein {port}',
      out: 'aus {port}',
      permissionsUsed: 'Verwendete Berechtigungen',
      refused: ' · {count} abgelehnt',
      logs: 'Protokoll',
    },
  },

  runPanel: {
    ariaLabel: 'Ausführung',
    title: 'Ausführung',
    recordingTitle:
      'Dies ist eine aufgezeichnete Ausführung, für den Debugger wiedergegeben. Sie ist nicht gerade eben auf diesem Rechner passiert.',
    empty:
      'Es wurde noch nichts ausgeführt. Drücken Sie oben auf Ausführen, dann erscheint hier jeder Schritt in der Reihenfolge, in der die Laufzeitumgebung ihn ausführt, mit Status und Dauer — oder, falls einer fehlschlägt, was schiefgegangen ist und was zu tun ist.',
    status: {
      pending: 'Wartend',
      running: 'Läuft',
      ok: 'Fertig',
      failed: 'Fehlgeschlagen',
      skipped: 'Übersprungen',
      cancelled: 'Abgebrochen',
      disabled: 'Ausgeschaltet',
    },
    outcome: {
      watching: 'Überwacht auf Änderungen …',
      running: 'Wird ausgeführt …',
      finished: 'Fertig.',
      finishedIn: 'Fertig in {took}.',
      partial: {
        one: '{count} Schritt ist fehlgeschlagen. Der Rest des Graphen wurde trotzdem ausgeführt.',
        other:
          '{count} Schritte sind fehlgeschlagen. Der Rest des Graphen wurde trotzdem ausgeführt.',
      },
      failed: 'Nichts wurde abgeschlossen.',
      cancelled: 'Angehalten.',
    },
    watch: {
      runsSoFar: {
        one: '{count} Ausführung bisher',
        other: '{count} Ausführungen bisher',
      },
      pendingWaiting: '{count} wartend',
    },
    step: {
      neverRan: 'Nie ausgeführt — {name} wurde nicht abgeschlossen.',
    },
  },

  onboarding: {
    tour: {
      stepCount: 'Schritt {current} von {total}',
      done: 'Fertig — machen Sie weiter, wenn Sie bereit sind.',
      waiting: 'Wartet darauf, dass Sie es ausprobieren.',
      finish: 'Fertigstellen',
      next: 'Weiter',
      canvas: {
        title: 'Dies ist Ihre Fläche',
        body: 'Ein Workflow besteht aus wenigen miteinander verbundenen Komponenten. Alles läuft auf diesem Rechner, und nichts greift auf Ihre Dateien zu, bevor Sie es erlauben.',
      },
      addFirst: {
        title: 'Fügen Sie den ersten Schritt hinzu',
        body: 'Links ist jede installierte Komponente. Finden Sie Ordner überwachen und fügen Sie sie hinzu — sie startet den Workflow, sobald irgendwo, wo Sie es wählen, eine Datei erscheint.',
      },
      addSecond: {
        title: 'Fügen Sie etwas zu tun hinzu',
        body: 'Fügen Sie nun Bild verkleinern hinzu. Es nimmt ein Bild und erstellt eine kleinere Kopie, ohne das Original zu verändern.',
      },
      connect: {
        title: 'Verbinden Sie sie miteinander',
        body: 'Ziehen Sie vom Datei-Port von Ordner überwachen zum Bild-Port von Bild verkleinern. Eine Datei ist noch kein Bild, daher fügt der Editor den Schritt ein, der sie öffnet — und verweigert die Verbindung von vornherein, wenn die beiden niemals zusammenpassen könnten.',
      },
      configure: {
        title: 'Sagen Sie ihm, welchen Ordner',
        body: 'Wählen Sie einen Schritt aus, um ihn rechts zu konfigurieren. Ordner überwachen muss wissen, welchen Ordner es überwachen soll, und Datei speichern muss wissen, wo das Ergebnis abgelegt werden soll.',
      },
      allow: {
        title: 'Erlauben Sie ihm diesen Ordner',
        body: 'Eine Komponente kann nichts anfassen, bis Sie es erlauben, und eine Berechtigung ist auf den einen Ordner beschränkt, den Sie wählen. Drücken Sie Erlauben bei dem Schritt, der danach gefragt hat.',
      },
      run: {
        title: 'Führen Sie es aus',
        body: 'Drücken Sie Ausführen, oder Strg+Eingabe. Jeder Schritt leuchtet auf, sobald er geschieht, und das Panel darunter zeichnet auf, was er getan hat und wie lange es gedauert hat.',
      },
    },
    welcome: {
      title: 'Willkommen bei Encastra',
      lead: 'Bauen Sie Software, indem Sie Komponenten zusammensetzen. Sie wählen die Teile, verbinden sie und drücken auf Ausführen — auf diesem Rechner, ohne dass etwas auf Ihre Dateien zugreift, bevor Sie es erlauben.',
      createFirst: {
        title: 'Erstellen Sie Ihren ersten Workflow',
        note: 'Ein kurzer geführter Durchlauf, etwa eine Minute',
      },
      exploreSample: {
        title: 'Ein Beispiel erkunden',
        note: '{name}, schon fertig gebaut — Sie wählen seine Ordner',
      },
      skip: {
        title: 'Überspringen',
        note: 'Direkt loslegen. Das finden Sie später in den Einstellungen, falls Sie es dann möchten.',
      },
    },
  },

  // Die einzige Frage, die diese Anwendung stellt, bevor Arbeit verworfen wird.
  unsaved: {
    title: 'Nicht gespeicherte Änderungen',
    reasons: {
      new: 'Sie haben nicht gespeicherte Änderungen. Ein neues Projekt zu beginnen würde sie verwerfen.',
      open: 'Sie haben nicht gespeicherte Änderungen. Ein anderes Projekt zu öffnen würde sie verwerfen.',
      demo: 'Sie haben nicht gespeicherte Änderungen. Ein Beispiel zu laden würde sie verwerfen.',
      restore:
        'Sie haben nicht gespeicherte Änderungen. Eine frühere Version wiederherzustellen würde sie verwerfen.',
      close: 'Sie haben nicht gespeicherte Änderungen. Encastra zu schließen würde sie verwerfen.',
      'library-open':
        'Sie haben nicht gespeicherte Änderungen. Etwas aus Ihrer Bibliothek zu öffnen würde sie verwerfen.',
    },
    save: 'Speichern und fortfahren',
    discard: 'Änderungen verwerfen',
    cancel: 'Abbrechen',
  },
  messages: {
    untitledProject: 'Unbenannt',
    recordingNote: 'Dies ist eine Aufzeichnung, keine Ausführung auf diesem Rechner.',
    problemsToFix: {
      one: '{count} zu behebendes Problem.',
      other: '{count} zu behebende Probleme.',
    },
    readyToRun: 'Dieser Graph ist bereit zur Ausführung.',
    nothingRanProblems: {
      one: 'Nichts wurde ausgeführt: {count} Problem zuerst zu beheben.',
      other: 'Nichts wurde ausgeführt: {count} Probleme zuerst zu beheben.',
    },
    saved: {
      one: 'Gespeichert. {count} Version aufbewahrt.',
      other: 'Gespeichert. {count} Versionen aufbewahrt.',
    },
    watchingChanges: 'Überwachung läuft. Dies wird ausgeführt, sobald etwas erscheint.',
    running: 'Wird ausgeführt.',
    stopping: 'Wird angehalten.',
    demoLoaded: '{name}: {needs} ausfüllen, dann starten.',
    restored: 'Wiederhergestellt. Die Version, von der Sie kamen, ist weiterhin im Verlauf.',
    missingComponents: 'Dieses Projekt braucht {missing}, was nicht installiert ist.',
    runtimeSilent: 'Etwas in der Laufzeitumgebung hat nicht geantwortet.',
    libraryMissing:
      '{name} liegt nicht mehr, wo es lag. Legen Sie es zurück oder öffnen Sie es dort, wo es jetzt ist.',
    imported: '{name} übernommen. Ausgeführt wurde nichts.',
    removedFromLibrary: '{name} steht nicht mehr auf der Liste. Die Datei liegt, wo sie lag.',
    removedAndDeleted:
      '{name} steht nicht mehr auf der Liste, und die von Encastra angelegte Kopie ist gelöscht.',
  },

  errors: {
    unknown:
      'Encastra hat dies aus einem Grund abgelehnt, für den diese Version keine Worte hat ({kind}). Es wurde nichts geändert.',
    runtimeBusy:
      'Die Laufzeit ist gerade mit etwas anderem beschäftigt. Versuchen Sie es gleich noch einmal.',
    libraryBusy: 'Ihre Bibliothek ist beschäftigt. Versuchen Sie es gleich noch einmal.',
    chooserDidNotReturn:
      'Die Ordnerauswahl wurde ohne Antwort geschlossen. Es wurde nichts ausgewählt.',
    notAFolderOnThisMachine:
      'Was die Auswahl zurückgegeben hat, ist kein Ordner auf diesem Rechner.',
    folderUnusable: 'Dieser Ordner kann nicht verwendet werden ({reason}).',
    notAProject: 'Das ist kein Encastra-Projekt. Der Name eines Projekts endet auf .encastra.',
    versionNotInProject:
      'Diese Version gehört nicht zu diesem Projekt. Sein Verlauf hat sich seit Ihrem letzten Blick vielleicht geändert.',
    versionsNotInProject:
      'Eine dieser beiden Versionen gehört nicht zu diesem Projekt, also gibt es nichts zu vergleichen.',
    grantsRefused:
      'Es wurde nichts ausgeführt. {count} der erteilten Berechtigungen konnten nicht vergeben werden:',
    workingFolder:
      'Encastra konnte für diesen Lauf keinen Arbeitsordner vorbereiten ({reason}). Es wurde nichts ausgeführt.',
    inputUnreadable: '{path} konnte nicht geöffnet werden ({reason}). Es wurde nichts ausgeführt.',
    workflowAlreadyRunning:
      'Es läuft bereits ein Ablauf. Stoppen Sie ihn, bevor Sie einen weiteren starten.',
    workflowInvalid:
      'Dieser Ablauf kann noch nicht laufen: {problems} Sache(n) sind vorher zu beheben.',
    workflowNotStarted:
      'Der Ablauf konnte nicht gestartet werden ({reason}). Es wurde nichts ausgeführt.',
    destinationMissing: 'Diesen Ordner gibt es nicht. Wählen Sie einen vorhandenen.',
    destinationIsALink:
      'Dieser Ordner ist eine Verknüpfung woandershin, das Geschriebene läge also nicht dort, wo Sie es gewählt haben. Wählen Sie den Ordner selbst.',
    destinationIsAFile:
      'Das ist eine Datei, kein Ordner. Eine Veröffentlichung braucht einen eigenen Ordner.',
    destinationNotChosen:
      'Wählen Sie den Zielordner zuerst über die Schaltfläche Wählen, damit Encastra dorthin schreibt, wohin Sie gezeigt haben.',
    publicationPathEscapes:
      'Diese Veröffentlichung kann nicht dorthin geschrieben werden, wohin sie gehen sollte. Es wurde nichts geschrieben.',
    publicationAlreadyThere:
      '{folder} enthält bereits eine Veröffentlichung. Löschen Sie sie, oder wählen Sie einen anderen Ordner.',
    notOursToDelete:
      'Diese Datei gehört Ihnen und bleibt, wo sie ist. Encastra löscht nur eigene Kopien, also Dinge, die Sie importiert haben.',
    copyNotDeleted:
      'Es steht nicht mehr auf Ihrer Liste, aber die Kopie konnte nicht gelöscht werden ({reason}).',
    noWindow: 'Es gibt kein Fenster zu schließen.',
    windowWouldNotClose: 'Das Fenster ließ sich nicht schließen. Ihre Arbeit ist noch da.',
    io: 'Etwas auf diesem Computer hat den Vorgang verweigert ({reason}).',
    status: {
      triggerError: '{node} beobachtet keine Änderungen mehr ({reason}).',
      eventsDropped: {
        one: '{count} Ereignis wurde verworfen — es kam schneller, als es bearbeitet werden konnte.',
        other:
          '{count} Ereignisse wurden verworfen — sie kamen schneller, als sie bearbeitet werden konnten.',
      },
      workflowStopped:
        'Dieser Ablauf ist unerwartet beendet worden. Sie können ihn erneut starten.',
      runningFor: {
        one: 'Läuft seit {seconds} Sekunde.',
        other: 'Läuft seit {seconds} Sekunden.',
      },
    },
    grant: {
      folderUnusable: '{node}: Dieser Ordner kann nicht verwendet werden ({reason}).',
      folderNotChosen:
        '{node}: Wählen Sie diesen Ordner über die Schaltfläche Wählen, bevor Sie ihn erlauben, damit das Erlaubte das ist, worauf Sie gezeigt haben.',
      notDeclared:
        '{node}: Dieser Schritt fragt nie nach {capability}, es gibt also nichts zu erlauben.',
    },
    project: {
      generic: 'Diese Projektdatei konnte nicht gelesen werden.',
      unsupportedSchema:
        'Diese Version liest Projektdateien der Version {ours}, und diese gibt Version {theirs} an. Sie stammt von einem neueren Encastra.',
      missingEntry:
        'Die Projektdatei enthält kein {entry}, sie ist also kein vollständiges Projekt.',
      invalid: '{entry} in diesem Projekt ist ungültig: {reason}.',
      archive:
        'Die Projektdatei ließ sich nicht als Archiv lesen ({reason}). Möglicherweise ist sie beschädigt.',
      tooLarge:
        '{entry} in diesem Projekt entpackt sich zu mehr, als diese Version liest ({limit} Bytes).',
      tooLargeInTotal:
        'Dieses Projekt entpackt sich zu mehr, als diese Version liest ({limit} Bytes insgesamt).',
      tooManySnapshots:
        'Dieses Projekt bewahrt {count} Versionen auf, diese Version höchstens {limit}.',
      fileTooLarge:
        'Diese Projektdatei hat {size} Bytes, und diese Version liest höchstens {limit}.',
      ambiguousArchive:
        'Das Projektarchiv führt {declared} Einträge unter nur {distinct} Namen, benennt also etwas doppelt. Encastra rät nicht, welcher gemeint war.',
      io: 'Die Projektdatei konnte nicht gelesen oder geschrieben werden ({reason}).',
    },
    library: {
      generic: 'Ihre Bibliothek konnte nicht gelesen werden.',
      corrupt:
        'Der Index Ihrer Bibliothek konnte nicht gelesen werden ({reason}). Er wurde unverändert gelassen: Er ist Ihre Aufzeichnung Ihrer eigenen Arbeit, und Encastra fängt sie nicht neu an.',
      writtenByAnotherVersion:
        'Der Index Ihrer Bibliothek wurde von einer anderen Encastra-Version geschrieben (er gibt Version {theirs} an, diese Version liest {ours}). Er wurde unverändert gelassen.',
      tooManyEntries:
        'Der Index Ihrer Bibliothek führt {count} Dinge, und diese Version fasst höchstens {max}. Er wurde unverändert gelassen.',
      notOurs: 'Das hat Encastra nicht dorthin gelegt, also entfernt Encastra es auch nicht.',
      io: 'Ihre Bibliothek konnte nicht gelesen oder geschrieben werden ({reason}).',
    },
    bundle: {
      generic: 'Diese Veröffentlichung konnte nicht vorbereitet werden.',
      reviewRefused:
        'Die Prüfung fand {blocking} Sache(n), die sich ändern müssten, bevor dies veröffentlicht werden kann.',
      notAVersion: '„{version}“ ist keine Version. Veröffentlichungen werden wie 1.2.0 nummeriert.',
      notYourNamespace:
        '„{listing}“ liegt nicht im Namensraum von {publisher}. Eine Veröffentlichung wird unter dem Namen dessen abgelegt, der sie veröffentlicht.',
      missing: 'Einer Veröffentlichung fehlt: {field}.',
      tooLong:
        'Das Feld {field} ist länger, als diese Version veröffentlicht (höchstens {max} Zeichen).',
      controlCharacters:
        'Das Feld {field} enthält Zeichen, die verbergen können, was dort wirklich steht. Encastra lehnt es ab, statt stillschweigend umzuschreiben, was Sie geschrieben haben.',
      tooLarge: 'Dieses Projekt hat etwa {size}, und diese Version veröffentlicht höchstens {max}.',
      notInstallable:
        'Diese Version kann {publicationKind} nicht installieren und bietet es daher auch nicht an.',
      notAnIdentifier: '„{value}“ ist kein brauchbarer Name: {why}.',
    },
    import: {
      generic:
        'Diese Veröffentlichung wurde nicht übernommen, und auf diesem Rechner wurde nichts geändert.',
    },
  },

  demos: {
    imageProcessor: {
      name: 'Bildprozessor',
      summary:
        'Überwacht einen Ordner. Sobald ein Bild erscheint, wird eine kleinere Kopie in einem anderen Ordner erstellt.',
      needs: {
        watch: 'Ein zu überwachender Ordner',
        save: 'Ein Ordner zum Speichern',
      },
    },
    fileOrganiser: {
      name: 'Dateiorganisator',
      summary:
        'Überwacht einen Ordner und verschiebt, was dort ankommt, je nach Dateityp in einen von drei anderen.',
      needs: {
        watch: 'Ein zu überwachender Ordner',
        images: 'Ein Ordner für Bilder',
        documents: 'Ein Ordner für Dokumente',
      },
    },
    thumbnails: {
      name: 'Miniaturansichten',
      summary:
        'Verwandelt einen Ordner voller Bilder in quadratische Vorschauen, bereit für eine Galerie oder ein Raster.',
      needs: {
        watch: 'Ein zu überwachender Ordner',
        save: 'Ein Ordner zum Speichern',
      },
    },
  },

  settings: {
    eyebrow: 'Einstellungen',
    nav: {
      ariaLabel: 'Einstellungskategorien',
    },
    categories: {
      general: {
        label: 'Allgemein',
        description: 'Erste Schritte, und was diese Anwendung beim Öffnen zeigt.',
      },
      appearance: {
        label: 'Erscheinungsbild',
        description: 'Thema und Bewegung.',
      },
      language: {
        label: 'Sprache & Region',
        description:
          'Die Sprache, die diese Oberfläche spricht, und wie sie Datumsangaben und Zahlen anzeigt.',
      },
      workspace: {
        label: 'Arbeitsbereich',
        description: 'Wo Ihre Projekte auf der Festplatte liegen.',
      },
      projects: {
        label: 'Projekte',
        description: 'Wie ein Projekt geöffnet wird, und in welchem Format es gespeichert wird.',
      },
      editor: {
        label: 'Editor',
        description: 'Tastenkürzel und Verhalten beim Erstellen eines Graphen.',
      },
      canvas: {
        label: 'Fläche',
        description:
          'Hilfen, die direkt auf der Fläche eingezeichnet sind: das Raster, das Einrasten, die Übersichtskarte.',
      },
      runtime: {
        label: 'Laufzeit',
        description: 'Was während der Ausführung eines Workflows auf dem Bildschirm passiert.',
      },
      components: {
        label: 'Komponenten',
        description:
          'Was in dieser Version installiert ist und worauf jede einzelne genau zugreifen kann.',
      },
      security: {
        label: 'Sicherheit',
        description:
          'Das Berechtigungsmodell, kurz gefasst. Die volle Detailansicht hat einen eigenen Bildschirm.',
      },
      privacy: {
        label: 'Datenschutz',
        description: 'Was diese Anwendung sammelt und sendet, als Tatsache dargestellt.',
      },
      notifications: {
        label: 'Benachrichtigungen',
        description: 'Wo die Benachrichtigungen eines Workflows erscheinen, und wo nicht.',
      },
      files: {
        label: 'Dateien',
        description: 'Was Encastra auf die Festplatte schreibt, und was nicht.',
      },
      updates: {
        label: 'Updates',
        description: 'Wie eine neuere Version auf diesen Rechner gelangt.',
      },
      account: {
        label: 'Konto',
        description: 'Anmeldung, Abonnements, und warum es keine gibt.',
      },
      developer: {
        label: 'Entwickler',
        description: 'Interna für alle, die sie wollen, und ein Weg zurück zu den Standardwerten.',
      },
      diagnostics: {
        label: 'Diagnose',
        description:
          'Was diese Version und dieser Rechner melden, fertig zum Einfügen in einen Fehlerbericht.',
      },
      about: {
        label: 'Info',
        description: 'Version, Build und wo die vollständige Dokumentation liegt.',
      },
    },

    shared: {
      startup: {
        label: 'Beim Start',
        hint: 'Was diese Anwendung beim Öffnen anzeigt.',
        options: {
          home: 'Start',
          lastProject: 'Letztes Projekt',
        },
      },
      runtimeStatus: {
        label: 'Laufzeitumgebung',
        hint: 'Ob eine echte Encastra-Laufzeitumgebung mit diesem Fenster verbunden ist.',
        attached: 'Verbunden',
        notAttached: 'Nicht verbunden — Vorschau im Browser',
      },
      signing: {
        label: 'Signierung',
        hint: 'Ob diese Version nachweisen kann, wer sie erstellt hat.',
        status: 'Nicht signiert',
      },
      version: {
        label: 'Version',
        hint: 'Die Version, die Sie gerade ausführen.',
        unknown: 'unbekannt',
      },
      openSecurity: 'Sicherheit öffnen',
      notBuilt: 'Noch nicht gebaut',
      noneCollected: 'Keine erhoben',
      schemaValue: 'Schema {value}',
      projectFormatHint: 'Wie eine gespeicherte .encastra-Datei geschrieben wird.',
    },

    general: {
      title: 'Erste Schritte',
      welcomeTour: {
        label: 'Willkommenstour',
        hint: 'Der geführte erste Workflow, einmalig beim ersten Start gezeigt.',
        button: 'Willkommen erneut anzeigen',
      },
    },

    appearance: {
      title: 'Erscheinungsbild',
      theme: {
        label: 'Thema',
        hint: 'System folgt Ihrem Betriebssystem. Hell und Dunkel bleiben unabhängig davon fest eingestellt.',
        options: {
          system: 'System',
          light: 'Hell',
          dark: 'Dunkel',
        },
      },
      motion: {
        label: 'Bewegung',
        hint: 'Reduziert schaltet Übergänge vollständig ab, statt sie nur zu verkürzen — unabhängig von der Systemeinstellung.',
        options: {
          system: 'System',
          reduced: 'Reduziert',
        },
      },
    },

    language: {
      interface: {
        title: 'Sprache',
        picker: {
          label: 'Oberflächensprache',
          hint: 'Übersetzt diese Anwendung. Englisch ist immer die Rückfalloption für alles, was in der gewählten Sprache noch nicht übersetzt ist.',
        },
        loading: 'Wird geladen…',
        loadError: '{name} konnte nicht geladen werden. Die aktuelle Sprache bleibt erhalten.',
        comingLater: {
          label: 'Nicht übersetzt',
          hint: 'Die Oberfläche ist so aufgebaut, dass sie diese unterstützt; übersetzt hat sie noch niemand.',
        },
      },
      formatting: {
        title: 'Wie diese Sprache Dinge schreibt',
        dates: {
          label: 'Datumsangaben',
          hint: 'Heute, in der Reihenfolge und den Wörtern dieser Sprache.',
        },
        times: {
          label: 'Uhrzeiten',
          hint: 'Die aktuelle Uhrzeit, nach der Konvention dieser Sprache.',
        },
        numbers: {
          label: 'Zahlen',
          hint: 'Eine Beispielzahl, gruppiert so, wie diese Sprache sie gruppiert.',
        },
        note: 'Jedes Datum, jede Uhrzeit und jede Zahl, die diese Anwendung anzeigt, folgt der Sprache oben — es gibt kein separates Format zur Auswahl, genau wie bei den meisten Programmen, die das richtig machen.',
      },
    },

    workspace: {
      title: 'Start',
      lastProject: {
        label: 'Letztes Projekt',
        hint: 'Wird automatisch erfasst, sobald Sie eines öffnen oder speichern. Wird verwendet, wenn Beim Start auf Letztes Projekt eingestellt ist — eines, das inzwischen verschoben oder gelöscht wurde, wird stillschweigend vergessen statt als Fehler angezeigt.',
        none: 'Noch keines',
      },
    },

    projects: {
      location: {
        title: 'Von wo aus sie geöffnet werden',
        label: 'Standard-Projektordner',
        hint: 'Wo der Speichern-Dialog startet. Leer gelassen öffnet er sich dort, wo das System zuletzt war.',
        placeholder: 'Kein Standardordner festgelegt',
        browse: 'Durchsuchen…',
        browseUnavailable: 'Erfordert die Desktop-Laufzeitumgebung, nicht diese Browser-Vorschau',
      },
      format: {
        title: 'Format',
        label: 'Projektdateiformat',
      },
      notBuilt: {
        title: 'Noch nicht gebaut',
        copy: 'Es gibt keine Liste zuletzt verwendeter Projekte. Einstellungen gelten pro Rechner statt pro Projekt — ein auf einem anderen Rechner geöffnetes Projekt bringt seine eigenen Einstellungen nicht mit, nur den Graphen selbst.',
      },
    },

    editor: {
      shortcuts: {
        title: 'Tastenkürzel',
        table: {
          shortcut: 'Tastenkürzel',
          action: 'Aktion',
        },
        actions: {
          runOrWatch:
            'Führt den Workflow aus, oder beginnt mit der Überwachung, wenn er mit einem Auslöser öffnet',
          save: 'Speichern',
          saveAs: 'Speichern unter',
          openProject: 'Projekt öffnen',
          undo: 'Rückgängig',
          redo: 'Wiederholen',
          copySelection: 'Auswahl kopieren',
          paste: 'Einfügen',
          duplicateSelection: 'Auswahl duplizieren',
          selectAll: 'Alles auswählen',
          deleteSelection: 'Auswahl löschen',
          connectFromStep:
            'Eine Verbindung vom ausgewählten Schritt aus beginnen, auf der Arbeitsfläche',
          cycleConnections:
            'Durch die Verbindungen des ausgewählten Schritts gehen, auf der Arbeitsfläche',
          deleteConnection: 'Die ausgewählte Verbindung löschen, auf der Arbeitsfläche',
        },
        note: 'Derzeit fest, nicht neu zuweisbar. Keines davon löst aus, während Sie in ein Textfeld tippen.',
      },
      notBuilt: {
        title: 'Noch nicht gebaut',
        copy: 'Automatisches Speichern, ein konfigurierbares Speicherintervall und das Anpassen der obigen Tastenkürzel sind noch nicht gebaut.',
      },
    },

    canvas: {
      title: 'Fläche',
      grid: {
        label: 'Raster',
        hint: 'Zeigt das Ausrichtungsraster hinter den Knoten auf der Fläche.',
      },
      snapToGrid: {
        label: 'Am Raster ausrichten',
        hint: 'Knoten rasten beim Ziehen am Raster ein, statt frei zu bleiben.',
      },
      minimap: {
        label: 'Übersichtskarte',
        hint: 'Eine kleine Übersicht des gesamten Graphen in der Ecke der Fläche.',
      },
    },

    runtime: {
      runs: {
        title: 'Ausführungen',
        openRunPanel: {
          label: 'Ausführungsbereich öffnen',
          hint: 'Bringt den Ausführungsbereich automatisch in den Vordergrund, sobald eine Ausführung startet.',
          toggleLabel: 'Ausführungsbereich bei Ausführung öffnen',
        },
      },
      notBuilt: {
        title: 'Noch nicht gebaut',
        copy: 'Paralleles Ausführen von Schritten, Zeitüberschreitungen bei der Ausführung, Wiederholungslimits und Ressourcenlimits pro Ausführung sind nicht konfigurierbar. Ein Workflow führt seine Schritte in der von der Validierung festgelegten Reihenfolge aus, bis zum Abschluss oder Fehlschlag, mit der Zeit und dem Speicher, die der Rechner ihm gibt.',
      },
    },

    components: {
      installed: {
        title: 'Installiert',
        components: {
          label: 'Komponenten',
          hint: 'Alles, womit diese Version fest ausgestattet ist, statt heruntergeladen.',
          builtIn: '{count} fest integriert',
        },
        thirdParty: {
          label: 'Drittanbieter',
          hint: 'Komponenten von außerhalb dieser Anwendung, ausgeführt in einer Sandbox ohne implizite Berechtigungen.',
          installed: '{count} installiert',
          notBuilt: 'Sandbox noch nicht gebaut',
        },
        permissionTable: {
          label: 'Vollständige Berechtigungstabelle',
          hint: 'Jede installierte Komponente, ihre Version und genau, worauf sie zugreifen kann.',
        },
      },
      table: {
        title: 'Jede Komponente, und worauf sie zugreifen kann',
        headers: {
          component: 'Komponente',
          version: 'Version',
          source: 'Quelle',
          canReach: 'Zugriff auf',
        },
        kind: {
          core: 'fest integriert',
          thirdParty: 'Drittanbieter',
        },
        none: 'nichts',
        note: 'Nichts außerhalb dieser Liste ist installiert, und nichts hier kann auf etwas zugreifen, das seine eigene Zeile nicht nennt — kein beliebiger Dateizugriff, keine Shell, kein Netzwerk über das Gelistete hinaus.',
      },
      capabilityLabels: {
        fsRead: 'Dateien lesen',
        fsWrite: 'Dateien schreiben',
        netHttp: 'Netzwerk nutzen',
        systemNotify: 'Benachrichtigungen anzeigen',
        systemClipboard: 'Zwischenablage nutzen',
      },
      installMore: {
        title: 'Mehr installieren',
        installFromFile: {
          label: 'Aus einer Datei installieren',
          hint: 'Eine Drittanbieter-Komponente zu dieser Version hinzufügen.',
        },
        note: 'Die Sandbox, in der diese Komponenten laufen würden, ist entworfen und dokumentiert, aber noch nicht gebaut — daher kann außer den oben aufgeführten {count} derzeit nichts installiert werden.',
      },
    },

    security: {
      title: 'Berechtigungsmodell',
      copy: 'Eine Komponente kann nicht auf Ihre Dateien, Ihr Netzwerk oder Ihre Zwischenablage zugreifen, sofern ihr Manifest es nicht deklariert und Sie es nicht erlauben — einmal pro Ausführung. Jede Anfrage, erlaubt oder abgelehnt, wird protokolliert und ist einsehbar.',
      thirdParty: {
        label: 'Drittanbieter-Komponenten',
        hint: 'Ob etwas außerhalb dieser Version installiert und ausgeführt werden kann.',
        status: 'Noch nicht möglich — die Sandbox ist nicht gebaut',
      },
      allowedInOpenWorkflow: {
        label: 'Im geöffneten Workflow erlaubt',
        hint: 'Wird gelöscht, sobald diese Anwendung geschlossen wird.',
        nothingAllowed: 'Nichts erlaubt',
        allowed: '{count} erlaubt',
      },
      fullDetail: {
        label: 'Vollständige Details',
        hint: 'Was wofür erlaubt wurde und wovor dies nicht schützt.',
      },
    },

    privacy: {
      collect: {
        title: 'Was diese Anwendung sammeln könnte, und nicht sammelt',
        telemetry: {
          label: 'Telemetrie',
          hint: 'Nutzungsdaten — welche Funktionen wie oft verwendet werden — an einen Server gesendet, damit ein Team seine Arbeit priorisieren könnte.',
        },
        crashReports: {
          label: 'Absturzberichte',
          hint: 'Ein Stack-Trace und eine Build-Version, automatisch bei einem Fehler gesendet, damit er behoben werden könnte, ohne dass Sie ihn selbst melden müssen.',
        },
        analytics: {
          label: 'Nutzungsanalyse',
          hint: 'Funktionszählungen, Sitzungsdauer, oder alles andere, das Ihre Nutzung dieser Anwendung in eine Zahl auf dem Dashboard einer anderen Person verwandeln würde.',
        },
        note: 'Alle drei bräuchten einen Server, an den gesendet wird. Es gibt keinen — ein „Aus“-Schalter hier würde einen Mechanismus vortäuschen, den es nicht gibt.',
      },
      account: {
        title: 'Konto',
        signIn: {
          label: 'Anmeldung',
          hint: 'Eine Identität, die an diese Anwendung gebunden ist, so wie die meiste Software mit Server eine verlangt.',
          status: 'Keine — es gibt keinen Server, bei dem man sich anmelden könnte',
        },
      },
      yourData: {
        title: 'Ihre Daten',
        projects: {
          label: 'Projekte',
          hint: 'Als .encastra-Dateien gespeichert, wo immer Sie sie ablegen. Keine versteckte Zweitkopie.',
          status: 'Bleiben auf diesem Rechner',
        },
        runJournals: {
          label: 'Ausführungsprotokolle',
          hint: 'Zeichnen Größen und Formen auf, niemals Dateiinhalte. Im Speicher gehalten, solange das Fenster geöffnet ist.',
          status: 'Beim Schließen verworfen',
        },
      },
    },

    notifications: {
      window: {
        title: 'In diesem Fenster',
        toast: {
          label: 'Kurzbenachrichtigungen',
          hint: 'Ein Workflow kann darum bitten, eine anzuzeigen, über dieselbe system.notify-Berechtigung wie jede andere — im Manifest deklariert und erlaubt, bevor irgendetwas erscheint.',
          shown: '{count} in dieser Sitzung angezeigt',
        },
        note: 'Die letzten bis zu 20 werden aufbewahrt, solange das Fenster geöffnet ist; sie zu verwerfen leert die Liste. Beim Schließen der Anwendung werden sie vergessen, genau wie alles andere, das kein gespeichertes Projekt ist.',
      },
      notBuilt: {
        title: 'Noch nicht gebaut',
        copy: 'Es gibt keine Benachrichtigungsberechtigung des Betriebssystems, keine E-Mail und keine Push-Benachrichtigung — nichts erreicht Sie außerhalb dieses Fensters. Auch ein Verlauf vergangener Benachrichtigungen über die aktuelle Sitzung hinaus ist nicht gebaut.',
      },
    },

    files: {
      disk: {
        title: 'Was auf der Festplatte liegt',
        projects: {
          term: 'Projekte',
          detail: 'Dateien, wo immer Sie sie speichern — siehe Projekte für den Standardordner.',
        },
        preferences: {
          term: 'Einstellungen',
          detail:
            'Browser-Speicher im eigenen Ursprung dieser Anwendung, keine Datei, die Sie direkt öffnen können.',
        },
        componentData: {
          term: 'Komponentendaten',
          detail:
            'Keine. Jede Komponente in dieser Version ist fest einkompiliert; nichts wird heruntergeladen oder zwischengespeichert.',
        },
        logs: {
          term: 'Protokolle',
          detail:
            'Keine auf die Festplatte geschrieben. Ein Ausführungsprotokoll wird im Speicher gehalten, solange das Fenster geöffnet ist, und beim Schließen verworfen.',
        },
      },
      notBuilt: {
        title: 'Noch nicht gebaut',
        copy: 'Es gibt keinen Import oder Export von Einstellungen, und keine Möglichkeit, Einstellungen zwischen Rechnern zu übertragen, außer sie dort erneut festzulegen. Ein Projekt selbst ist bereits portabel — es ist eine einzige Datei —, aber die Einstellungen auf diesem Bildschirm sind es nicht.',
      },
    },

    updates: {
      thisBuild: {
        title: 'Diese Version',
        channel: {
          label: 'Wie eine neuere diesen Rechner erreicht',
          hint: 'Was passiert, wenn eine neue Version erscheint.',
          fact: 'Kein Update-Kanal. Aktualisieren bedeutet, einen neuen Installer herunterzuladen und ihn über diesen zu installieren.',
        },
      },
      verify: {
        title: 'Was Sie installieren, überprüfen',
        copy: 'Versionen sind nicht signiert, daher warnt Windows vor einem nicht erkannten Herausgeber — eine zutreffende Warnung, da nichts hier beweist, wer die Datei erstellt hat. Jede Version veröffentlicht stattdessen einen SHA-256-Hash, um einen Installer vor dem Ausführen zu überprüfen.',
      },
      notBuilt: {
        title: 'Noch nicht gebaut',
        copy: 'Automatische Update-Prüfungen, Update-Kanäle als funktionierender Mechanismus und Hintergrund-Downloads sind nicht gebaut. Auf eine neue Version zu prüfen bedeutet heute, es von Hand zu tun.',
      },
    },

    account: {
      title: 'Keine Konten',
      copy: 'Es gibt keine Anmeldung, kein Konto und keinen Server, mit dem eines sprechen könnte. Nichts hier hat ein Abonnement, einen Plan, eine Sitzung oder eine Geräteliste zu verwalten — jedes Projekt und jede Einstellung auf diesem Bildschirm lebt auf diesem Rechner, und nur auf diesem Rechner.',
    },

    developer: {
      internals: {
        title: 'Interna',
        developerMode: {
          label: 'Entwicklermodus',
          hint: 'Zeigt die rohen Einstellungswerte und eine kompakte Übersicht jeder geladenen Komponente weiter unten.',
        },
      },
      currentPreferences: {
        title: 'Aktuelle Einstellungen',
      },
      loadedComponents: {
        title: 'Geladene Komponenten',
      },
      hidden: {
        title: 'Derzeit ausgeblendet',
        copy: 'Aktivieren Sie oben den Entwicklermodus, um die rohen Einstellungswerte und eine Übersicht jeder geladenen Komponente zu sehen.',
      },
      reset: {
        title: 'Zurücksetzen',
        restoreDefaults: {
          label: 'Standardwerte wiederherstellen',
          hint: 'Setzt jede Einstellung auf diesem Bildschirm auf den Zustand beim ersten Start zurück. Betrifft nicht Ihre Projekte, erteilten Berechtigungen oder installierten Komponenten.',
          button: 'Alle Einstellungen zurücksetzen',
        },
      },
    },

    diagnostics: {
      rows: {
        version: 'Encastra-Version',
        runtime: 'Runtime',
        protocolSchema: 'Schema des Komponentenprotokolls',
        projectSchema: 'Schema des Projektformats',
        components: 'Installierte Komponenten',
        platform: 'Plattform',
        architecture: 'Architektur',
        gpu: 'GPU',
        userAgent: 'WebView-User-Agent',
        gpuUnknown: 'Nicht ermittelbar',
        platformUnknown: 'Unbekannt',
        architectureUnknown: 'Vom WebView nicht gemeldet',
      },
      machine: {
        title: 'Dieser Rechner und diese Version',
      },
      share: {
        title: 'Teilen',
        copy: {
          label: 'Kopieren',
          hint: 'Kopiert alle Zeilen oben in die Zwischenablage.',
          button: 'Kopieren',
          copied: 'Kopiert',
          failed: 'Kopieren fehlgeschlagen',
        },
        export: {
          label: 'Exportieren',
          hint: 'Speichert denselben Bericht als Textdatei.',
          button: 'Exportieren…',
        },
        note: 'Nichts hier enthält einen Projektpfad, einen Einstellungswert oder ein Token — es ist so gedacht, dass es gefahrlos irgendwo öffentlich eingefügt werden kann. Der Bericht wird auf Englisch kopiert und exportiert, damit ihn alle im Projekt lesen können.',
      },
    },

    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Software aus Teilen bauen, die wirklich zusammenpassen.',
      },
      thisBuild: {
        title: 'Diese Version',
        componentProtocol: {
          label: 'Komponentenprotokoll',
          hint: 'Was das Manifest einer Komponente erfüllen muss, um geladen zu werden.',
        },
        projectFormat: {
          label: 'Projektformat',
        },
        updates: {
          label: 'Updates',
          hint: 'Wie eine neuere Version auf diesen Rechner gelangt.',
          fact: 'Kein Update-Kanal. Aktualisieren bedeutet, einen neuen Installer herunterzuladen.',
        },
      },
      readMore: {
        title: 'Mehr lesen',
        readme: 'was Encastra ist',
        security: 'das Berechtigungsmodell, vollständig',
        release: 'wie eine Version erstellt und verifiziert wird',
        roadmap: 'was gebaut ist und was noch nicht',
      },
    },
  },
};

export default de;
