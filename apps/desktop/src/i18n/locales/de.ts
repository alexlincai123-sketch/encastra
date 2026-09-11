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
  },

  sidebar: {
    ariaLabel: 'Bereiche',
    running: ', läuft',
    items: {
      home: 'Start',
      builder: 'Builder',
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
    },
    empty: {
      heading: 'Ihre Fläche ist leer',
      body: 'Ein Workflow besteht aus wenigen miteinander verbundenen Komponenten. Wählen Sie links eine aus, um Ihren ersten Schritt zu platzieren, verbinden Sie seine Ausgabe mit dem nächsten und drücken Sie Ausführen.',
      hint: 'Jede Komponente nennt vorher, worauf sie zugreifen kann, und nichts berührt Ihre Dateien, bevor Sie es erlauben.',
    },
    keysHint:
      'Mit den Pfeiltasten zwischen Schritten bewegen, mit Eingabe einen Schritt im Inspektor öffnen, mit Escape die Auswahl aufheben und mit Entf den ausgewählten Schritt entfernen.',
    a11y: {
      selected: '{name}, Schritt {index} von {total}, ausgewählt.',
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
        description: 'Erscheinungsbild, Bewegung und die Einführungstour.',
      },
      workspace: {
        label: 'Arbeitsbereich',
        description: 'Wo Projekte liegen und womit diese Anwendung startet.',
      },
      editor: {
        label: 'Editor',
        description: 'Hilfen, die auf der Fläche beim Erstellen eines Graphen angezeigt werden.',
      },
      runtime: {
        label: 'Laufzeit',
        description: 'Was während der Ausführung eines Workflows auf dem Bildschirm passiert.',
      },
      components: {
        label: 'Komponenten',
        description: 'Was in dieser Version installiert ist und worauf jede zugreifen kann.',
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
      advanced: {
        label: 'Erweitert',
        description: 'Interna für alle, die sie wollen, und ein Weg zurück zu den Standardwerten.',
      },
      about: {
        label: 'Info',
        description: 'Version, Build und wo die vollständige Dokumentation liegt.',
      },
    },
    general: {
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
      getStarted: {
        title: 'Erste Schritte',
        welcomeTour: {
          label: 'Willkommenstour',
          hint: 'Der geführte erste Workflow, einmalig beim ersten Start gezeigt.',
          button: 'Willkommen erneut anzeigen',
        },
      },
    },
    workspace: {
      projects: {
        title: 'Projekte',
        folder: {
          label: 'Standard-Projektordner',
          hint: 'Wo der Speichern-Dialog startet. Leer gelassen öffnet er sich dort, wo das System zuletzt war.',
          placeholder: 'Kein Standardordner festgelegt',
          browseTitleUnavailable:
            'Erfordert die Desktop-Laufzeitumgebung, nicht diese Browser-Vorschau',
        },
        startup: {
          label: 'Beim Start',
          hint: 'Was diese Anwendung beim Öffnen anzeigt.',
          options: {
            home: 'Start',
            lastProject: 'Letztes Projekt',
          },
        },
      },
    },
    editor: {
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
    },
    runtime: {
      runs: {
        title: 'Ausführungen',
        openRunPanel: {
          label: 'Ausführungsbereich öffnen',
          hint: 'Bringt den Ausführungsbereich automatisch in den Vordergrund, sobald eine Ausführung startet.',
        },
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
          button: 'Sicherheit öffnen',
        },
      },
      installMore: {
        title: 'Mehr installieren',
        installFromFile: {
          label: 'Aus einer Datei installieren',
          hint: 'Eine Drittanbieter-Komponente zu dieser Version hinzufügen.',
          status: 'Noch nicht gebaut',
        },
        note: 'Die Sandbox, in der diese Komponenten laufen würden, ist entworfen und dokumentiert, aber noch nicht gebaut — daher kann außer den oben aufgeführten {count} derzeit nichts installiert werden.',
      },
    },
    security: {
      permissionModel: {
        title: 'Berechtigungsmodell',
        copy: 'Eine Komponente kann nicht auf Ihre Dateien, Ihr Netzwerk oder Ihre Zwischenablage zugreifen, sofern ihr Manifest es nicht deklariert und Sie es nicht erlauben — einmal pro Ausführung. Jede Anfrage, erlaubt oder abgelehnt, wird protokolliert und ist einsehbar.',
        allowedInOpenWorkflow: {
          label: 'Im geöffneten Workflow erlaubt',
          hint: 'Wird gelöscht, sobald diese Anwendung geschlossen wird.',
          nothingAllowed: 'Nichts erlaubt',
          allowed: '{count} erlaubt',
        },
        fullDetail: {
          label: 'Vollständige Details',
          hint: 'Was wofür erlaubt wurde und wovor dies nicht schützt.',
          button: 'Sicherheit öffnen',
        },
      },
    },
    privacy: {
      collection: {
        title: 'Erhebung',
        telemetry: {
          label: 'Telemetrie',
          hint: 'Nutzungsdaten, die an einen Server gesendet werden.',
          status: 'Keine erhoben',
        },
        crashReports: {
          label: 'Absturzberichte',
          hint: 'Automatische Berichte, die bei einem Fehler irgendwohin gesendet werden.',
          status: 'Keine',
        },
        analytics: {
          label: 'Analytik',
          hint: 'Nutzungsmuster, Funktionszählungen oder Ähnliches.',
          status: 'Keine',
        },
        account: {
          label: 'Konto',
          hint: 'Eine Anmeldung oder ein Abonnement, das an diese Anwendung gebunden ist.',
          status: 'Keines — es gibt keinen Server',
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
    advanced: {
      internals: {
        title: 'Interna',
        developerMode: {
          label: 'Entwicklermodus',
          hint: 'Zeigt Komponenten-IDs, Prüfsummen und das rohe Ausführungsprotokoll für alle, die sie wollen.',
        },
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
    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Software aus Teilen bauen, die wirklich zusammenpassen.',
      },
      thisBuild: {
        title: 'Diese Version',
        version: {
          label: 'Version',
          hint: 'Die Version, die Sie gerade ausführen.',
          unknown: 'unbekannt',
        },
        runtime: {
          label: 'Laufzeitumgebung',
          hint: 'Ob eine echte Encastra-Laufzeitumgebung mit diesem Fenster verbunden ist.',
          attached: 'Verbunden',
          notAttached: 'Nicht verbunden — Vorschau im Browser',
        },
        componentProtocol: {
          label: 'Komponentenprotokoll',
          hint: 'Was das Manifest einer Komponente erfüllen muss, um geladen zu werden.',
        },
        projectFormat: {
          label: 'Projektformat',
          hint: 'Wie eine gespeicherte .encastra-Datei geschrieben wird.',
        },
        signing: {
          label: 'Signierung',
          hint: 'Ob diese Version nachweisen kann, wer sie erstellt hat.',
          status: 'Nicht signiert',
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
