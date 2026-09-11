/**
 * Italiano. Ogni chiave qui deve esistere anche in inglese — lo verifica `i18n.test.ts`. Una
 * chiave mancante ricade semplicemente sull'inglese; una traduzione incerta non viene inclusa.
 */

import type { Messages } from '../index';

const it: Messages = {
  common: {
    close: 'Chiudi',
    dismiss: 'Ignora',
  },

  sidebar: {
    ariaLabel: 'Sezioni',
    running: ', in esecuzione',
    items: {
      home: 'Home',
      builder: 'Builder',
      components: 'Componenti',
      security: 'Sicurezza',
      settings: 'Impostazioni',
    },
  },

  home: {
    intro: {
      heading: 'Crea software con parti che si incastrano davvero.',
      body: 'Metti i componenti su una tela, collegali e premi avvia. Tutto viene eseguito su questo computer, e nulla accede ai tuoi file senza che venga prima richiesto.',
    },
    actions: {
      new: {
        title: 'Nuovo flusso di lavoro',
        detail: 'Parti da una tela vuota',
      },
      open: {
        title: 'Apri',
        detailReady: 'Un file .encastra salvato in precedenza',
        detailUnavailable: 'Richiede l’applicazione desktop',
      },
      browse: {
        title: 'Sfoglia i componenti',
        detail: {
          one: '{count} installato, e cosa può raggiungere',
          other: '{count} installati, e cosa può raggiungere ciascuno',
        },
      },
    },
    continue: {
      heading: 'Dove eri rimasto',
      steps: {
        one: '{count} passaggio',
        other: '{count} passaggi',
      },
      unsaved: ' · non ancora salvato',
    },
    samples: {
      heading: 'Esempi',
      note: 'Flussi di lavoro reali sul motore di esecuzione reale. Ognuno richiede di scegliere le sue cartelle prima di poter partire — un esempio che scrivesse in un posto non scelto da te sarebbe esattamente l’opposto dello scopo.',
      needs: 'Richiede: {list}',
    },
  },

  palette: {
    title: 'Componenti',
    empty: 'Nessun componente installato.',
    asksTo: 'Chiede di: {list}',
    capabilities: {
      fsRead: 'leggere i file',
      fsWrite: 'scrivere i file',
      netHttp: 'usare la rete',
      systemNotify: 'mostrare notifiche',
      systemClipboard: 'usare gli appunti',
    },
  },

  canvas: {
    ariaLabel: 'Tela del flusso di lavoro',
    refusal: {
      selfCycle: {
        headline: 'Un passaggio non può alimentare se stesso.',
        detail:
          'Un flusso di lavoro procede in avanti. Per ripetere lo stesso lavoro più volte, avvialo da un trigger — Osserva cartella o Timer — che lo esegue una volta per ogni evento.',
      },
      bridge: 'Un passaggio che produce {bridge} nel mezzo li collegherebbe.',
    },
    empty: {
      heading: 'La tua tela è vuota',
      body: 'Un flusso di lavoro è composto da pochi componenti collegati tra loro. Scegline uno a sinistra per posizionare il tuo primo passaggio, collega la sua uscita al successivo e premi Esegui.',
      hint: 'Ogni componente indica cosa può raggiungere prima di essere eseguito, e nulla tocca i tuoi file finché non lo permetti.',
    },
    keysHint:
      'Usa le frecce per spostarti tra i passaggi, Invio per aprire un passaggio nell’ispettore, Esc per deselezionare e Canc per rimuovere il passaggio selezionato.',
    a11y: {
      selected: '{name}, passaggio {index} di {total}, selezionato.',
    },
  },

  settings: {
    eyebrow: 'Impostazioni',
    nav: {
      ariaLabel: 'Categorie di impostazioni',
    },
    categories: {
      general: {
        label: 'Generale',
        description: 'Aspetto, movimento e il tour del primo avvio.',
      },
      workspace: {
        label: 'Area di lavoro',
        description: 'Dove vivono i progetti, e con cosa si apre questa applicazione.',
      },
      editor: {
        label: 'Editor',
        description: 'Aiuti mostrati sulla tela mentre costruisci un grafo.',
      },
      runtime: {
        label: 'Runtime',
        description: 'Cosa appare a schermo mentre un flusso di lavoro viene eseguito.',
      },
      components: {
        label: 'Componenti',
        description: 'Cosa è installato in questa versione, e cosa può raggiungere ciascuno.',
      },
      security: {
        label: 'Sicurezza',
        description:
          'Il modello dei permessi, in breve. Il dettaglio completo vive nella sua schermata.',
      },
      privacy: {
        label: 'Privacy',
        description: 'Cosa raccoglie e invia questa applicazione, dichiarato come fatto.',
      },
      advanced: {
        label: 'Avanzate',
        description:
          'Dettagli interni per chi li vuole, e un modo per tornare ai valori predefiniti.',
      },
      about: {
        label: 'Informazioni',
        description: 'Versione, build, e dove si trova la documentazione completa.',
      },
    },
    general: {
      appearance: {
        title: 'Aspetto',
        theme: {
          label: 'Tema',
          hint: 'Sistema segue il tuo sistema operativo. Chiaro e scuro restano fissi indipendentemente da esso.',
          options: {
            system: 'Sistema',
            light: 'Chiaro',
            dark: 'Scuro',
          },
        },
        motion: {
          label: 'Movimento',
          hint: 'Ridotto disattiva completamente le transizioni invece di accorciarle, indipendentemente da cosa preferisce il tuo sistema.',
          options: {
            system: 'Sistema',
            reduced: 'Ridotto',
          },
        },
      },
      getStarted: {
        title: 'Per iniziare',
        welcomeTour: {
          label: 'Tour di benvenuto',
          hint: 'Il primo flusso di lavoro guidato, mostrato una volta al primo avvio.',
          button: 'Mostra di nuovo il benvenuto',
        },
      },
    },
    workspace: {
      projects: {
        title: 'Progetti',
        folder: {
          label: 'Cartella progetti predefinita',
          hint: 'Da dove parte la finestra di salvataggio. Se lasciata vuota, si apre dove si trovava l’ultima volta il sistema.',
          placeholder: 'Nessuna cartella predefinita impostata',
          browseTitleUnavailable: 'Richiede il runtime desktop, non questa anteprima nel browser',
        },
        startup: {
          label: 'All’avvio',
          hint: 'Cosa mostra questa applicazione quando si apre.',
          options: {
            home: 'Home',
            lastProject: 'Ultimo progetto',
          },
        },
      },
    },
    editor: {
      canvas: {
        title: 'Tela',
        grid: {
          label: 'Griglia',
          hint: 'Mostra la griglia di allineamento dietro i nodi sulla tela.',
        },
        snapToGrid: {
          label: 'Aggancia alla griglia',
          hint: 'I nodi si allineano alla griglia mentre li trascini, invece di restare liberi.',
        },
        minimap: {
          label: 'Minimappa',
          hint: 'Una piccola panoramica dell’intero grafo nell’angolo della tela.',
        },
      },
    },
    runtime: {
      runs: {
        title: 'Esecuzioni',
        openRunPanel: {
          label: 'Apri il pannello di esecuzione',
          hint: 'Porta automaticamente in primo piano il pannello di esecuzione non appena inizia un’esecuzione.',
        },
      },
    },
    components: {
      installed: {
        title: 'Installati',
        components: {
          label: 'Componenti',
          hint: 'Tutto ciò con cui questa versione è dotata di base, anziché scaricato.',
          builtIn: '{count} inclusi di base',
        },
        thirdParty: {
          label: 'Di terze parti',
          hint: 'Componenti esterni a questa applicazione, eseguiti in una sandbox senza autorità ambientale.',
          installed: '{count} installati',
          notBuilt: 'La sandbox non è ancora stata costruita',
        },
        permissionTable: {
          label: 'Tabella completa dei permessi',
          hint: 'Ogni componente installato, la sua versione, ed esattamente cosa può raggiungere.',
          button: 'Apri Sicurezza',
        },
      },
      installMore: {
        title: 'Installa altro',
        installFromFile: {
          label: 'Installa da un file',
          hint: 'Aggiungi un componente di terze parti a questa versione.',
          status: 'Non ancora costruita',
        },
        note: 'La sandbox in cui questi componenti verrebbero eseguiti è progettata e documentata ma non ancora costruita, quindi al momento non si può installare nulla oltre ai {count} elencati sopra.',
      },
    },
    security: {
      permissionModel: {
        title: 'Modello dei permessi',
        copy: 'Un componente non può accedere ai tuoi file, alla tua rete o agli appunti a meno che il suo manifesto non lo dichiari e tu non lo consenta — una volta per esecuzione. Ogni richiesta, consentita o rifiutata, viene registrata dove puoi leggerla.',
        allowedInOpenWorkflow: {
          label: 'Consentito nel flusso di lavoro aperto',
          hint: 'Cancellato non appena questa applicazione si chiude.',
          nothingAllowed: 'Nulla consentito',
          allowed: '{count} consentiti',
        },
        fullDetail: {
          label: 'Dettaglio completo',
          hint: 'Cosa è stato consentito, a cosa, e da cosa questo non protegge.',
          button: 'Apri Sicurezza',
        },
      },
    },
    privacy: {
      collection: {
        title: 'Raccolta',
        telemetry: {
          label: 'Telemetria',
          hint: 'Dati di utilizzo inviati a un server.',
          status: 'Nessuno raccolto',
        },
        crashReports: {
          label: 'Segnalazioni di arresto anomalo',
          hint: 'Segnalazioni automatiche inviate da qualche parte quando qualcosa fallisce.',
          status: 'Nessuna',
        },
        analytics: {
          label: 'Analisi',
          hint: 'Modelli di utilizzo, conteggi delle funzionalità o simili.',
          status: 'Nessuna',
        },
        account: {
          label: 'Account',
          hint: 'Un accesso o un abbonamento legato a questa applicazione.',
          status: 'Nessuno — non c’è alcun server',
        },
      },
      yourData: {
        title: 'I tuoi dati',
        projects: {
          label: 'Progetti',
          hint: 'Salvati come file .encastra dove decidi tu. Nessuna copia nascosta.',
          status: 'Restano su questo computer',
        },
        runJournals: {
          label: 'Registri di esecuzione',
          hint: 'Registrano dimensioni e forme, mai il contenuto dei file. Tenuti in memoria finché la finestra è aperta.',
          status: 'Eliminati alla chiusura',
        },
      },
    },
    advanced: {
      internals: {
        title: 'Dettagli interni',
        developerMode: {
          label: 'Modalità sviluppatore',
          hint: 'Mostra gli id dei componenti, i digest e il registro di esecuzione grezzo per chi li vuole.',
        },
      },
      reset: {
        title: 'Ripristino',
        restoreDefaults: {
          label: 'Ripristina i valori predefiniti',
          hint: 'Riporta ogni impostazione di questa schermata a come era al primo avvio. Non tocca i tuoi progetti, i permessi concessi o i componenti installati.',
          button: 'Ripristina tutte le impostazioni',
        },
      },
    },
    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Crea software con parti che si incastrano davvero.',
      },
      thisBuild: {
        title: 'Questa versione',
        version: {
          label: 'Versione',
          hint: 'La versione che stai eseguendo.',
          unknown: 'sconosciuta',
        },
        runtime: {
          label: 'Runtime',
          hint: 'Se un vero runtime Encastra è collegato a questa finestra.',
          attached: 'Collegato',
          notAttached: 'Non collegato — anteprima nel browser',
        },
        componentProtocol: {
          label: 'Protocollo dei componenti',
          hint: 'Cosa deve rispettare il manifesto di un componente per essere caricato.',
        },
        projectFormat: {
          label: 'Formato del progetto',
          hint: 'Come viene scritto un file .encastra salvato.',
        },
        signing: {
          label: 'Firma',
          hint: 'Se questa versione può dimostrare chi l’ha prodotta.',
          status: 'Non firmata',
        },
        updates: {
          label: 'Aggiornamenti',
          hint: 'Come una versione più recente arriva su questo computer.',
          fact: 'Nessun canale di aggiornamento. Aggiornare significa scaricare un nuovo installer.',
        },
      },
      readMore: {
        title: 'Per saperne di più',
        readme: 'cos’è Encastra',
        security: 'il modello dei permessi, per intero',
        release: 'come viene prodotta e verificata una versione',
        roadmap: 'cosa è già costruito e cosa non lo è ancora',
      },
    },
  },
};

export default it;
