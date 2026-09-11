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
        description: 'Come iniziare, e cosa ti mostra questa applicazione quando si apre.',
      },
      appearance: {
        label: 'Aspetto',
        description: 'Tema e movimento.',
      },
      language: {
        label: 'Lingua e regione',
        description: 'La lingua che parla questa interfaccia, e come mostra date e numeri.',
      },
      workspace: {
        label: 'Area di lavoro',
        description: 'Dove vivono i tuoi progetti sul disco.',
      },
      projects: {
        label: 'Progetti',
        description: 'Come si apre un progetto, e il formato in cui viene salvato.',
      },
      editor: {
        label: 'Editor',
        description: 'Scorciatoie e comportamento mentre costruisci un grafo.',
      },
      canvas: {
        label: 'Tela',
        description: 'Aiuti disegnati sulla tela stessa: la griglia, lo snap, la minimappa.',
      },
      runtime: {
        label: 'Runtime',
        description: 'Cosa appare a schermo mentre un flusso di lavoro viene eseguito.',
      },
      components: {
        label: 'Componenti',
        description:
          'Cosa è installato in questa versione, ed esattamente cosa può raggiungere ciascuno.',
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
      notifications: {
        label: 'Notifiche',
        description: 'Dove appaiono le notifiche di un flusso di lavoro, e dove no.',
      },
      files: {
        label: 'File',
        description: 'Cosa scrive Encastra sul disco, e cosa no.',
      },
      updates: {
        label: 'Aggiornamenti',
        description: 'Come una versione più recente arriva su questo computer.',
      },
      account: {
        label: 'Account',
        description: 'Accesso, abbonamenti, e perché non ce ne sono.',
      },
      developer: {
        label: 'Sviluppatore',
        description:
          'Dettagli interni per chi li vuole, e un modo per tornare ai valori predefiniti.',
      },
      diagnostics: {
        label: 'Diagnostica',
        description:
          'Cosa riportano questa versione e questo computer, pronto da incollare in una segnalazione di bug.',
      },
      about: {
        label: 'Informazioni',
        description: 'Versione, build, e dove si trova la documentazione completa.',
      },
    },

    shared: {
      startup: {
        label: 'All’avvio',
        hint: 'Cosa mostra questa applicazione quando si apre.',
        options: {
          home: 'Home',
          lastProject: 'Ultimo progetto',
        },
      },
      runtimeStatus: {
        label: 'Runtime',
        hint: 'Se un vero runtime Encastra è collegato a questa finestra.',
        attached: 'Collegato',
        notAttached: 'Non collegato — anteprima nel browser',
      },
      signing: {
        label: 'Firma',
        hint: 'Se questa versione può dimostrare chi l’ha prodotta.',
        status: 'Non firmata',
      },
      version: {
        label: 'Versione',
        hint: 'La versione che stai eseguendo.',
        unknown: 'sconosciuta',
      },
      openSecurity: 'Apri Sicurezza',
      notBuilt: 'Non ancora costruito',
      noneCollected: 'Nessun dato raccolto',
      schemaValue: 'schema {value}',
      projectFormatHint: 'Come viene scritto un file .encastra salvato.',
    },

    general: {
      title: 'Come iniziare',
      welcomeTour: {
        label: 'Tour di benvenuto',
        hint: 'Il primo flusso di lavoro guidato, mostrato una volta al primo avvio.',
        button: 'Mostra di nuovo il benvenuto',
      },
    },

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

    language: {
      interface: {
        title: 'Lingua',
        picker: {
          label: 'Lingua dell’interfaccia',
          hint: 'Traduce questa applicazione. L’inglese è sempre il ripiego per ciò che non è ancora tradotto nella lingua che scegli.',
        },
        loading: 'Caricamento…',
        loadError: 'Impossibile caricare {name}. Resta attiva la lingua corrente.',
        comingLater: {
          label: 'In arrivo',
          hint: 'L’interfaccia è strutturata per supportarle; nessuno le ha ancora tradotte.',
        },
      },
      formatting: {
        title: 'Come questa lingua scrive le cose',
        dates: {
          label: 'Date',
          hint: 'Oggi, nell’ordine e con le parole proprie di questa lingua.',
        },
        times: {
          label: 'Orari',
          hint: 'L’ora attuale, secondo la convenzione di questa lingua.',
        },
        numbers: {
          label: 'Numeri',
          hint: 'Un numero di esempio, raggruppato come lo raggruppa questa lingua.',
        },
        note: 'Ogni data, ora e numero che questa applicazione mostra segue la lingua qui sopra — non c’è un formato separato da scegliere, come nella maggior parte dei software che lo fanno bene.',
      },
    },

    workspace: {
      title: 'Avvio',
      lastProject: {
        label: 'Ultimo progetto',
        hint: 'Registrato automaticamente ogni volta che ne apri o salvi uno. Usato quando All’avvio è impostato su Ultimo progetto — uno che nel frattempo è stato spostato o eliminato viene semplicemente dimenticato, invece di essere mostrato come errore.',
        none: 'Ancora nessuno',
      },
    },

    projects: {
      location: {
        title: 'Da dove si aprono',
        label: 'Cartella progetti predefinita',
        hint: 'Da dove parte la finestra di salvataggio. Se lasciata vuota, si apre dove si trovava l’ultima volta il sistema.',
        placeholder: 'Nessuna cartella predefinita impostata',
        browse: 'Sfoglia…',
        browseUnavailable: 'Richiede il runtime desktop, non questa anteprima nel browser',
      },
      format: {
        title: 'Formato',
        label: 'Formato del file di progetto',
      },
      notBuilt: {
        title: 'Non ancora costruito',
        copy: 'Non c’è una lista di progetti recenti. Le impostazioni sono per computer, non per progetto — un progetto aperto su un altro computer non porta con sé le proprie preferenze, solo il grafo stesso.',
      },
    },

    editor: {
      shortcuts: {
        title: 'Scorciatoie da tastiera',
        table: {
          shortcut: 'Scorciatoia',
          action: 'Azione',
        },
        actions: {
          runOrWatch: 'Esegue il flusso di lavoro, o inizia a osservare se si apre con un trigger',
          save: 'Salva',
          saveAs: 'Salva come',
          openProject: 'Apri un progetto',
          undo: 'Annulla',
          redo: 'Ripeti',
          copySelection: 'Copia la selezione',
          paste: 'Incolla',
          duplicateSelection: 'Duplica la selezione',
          selectAll: 'Seleziona tutto',
          deleteSelection: 'Elimina la selezione',
        },
        note: 'Fisse per ora, non riassegnabili. Nessuna di queste si attiva mentre digiti in un campo di testo.',
      },
      notBuilt: {
        title: 'Non ancora costruito',
        copy: 'Il salvataggio automatico, un intervallo di salvataggio configurabile e la personalizzazione delle scorciatoie qui sopra non sono ancora costruiti.',
      },
    },

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

    runtime: {
      runs: {
        title: 'Esecuzioni',
        openRunPanel: {
          label: 'Apri il pannello di esecuzione',
          hint: 'Porta automaticamente in primo piano il pannello di esecuzione non appena inizia un’esecuzione.',
          toggleLabel: 'Apri il pannello di esecuzione all’avvio di un’esecuzione',
        },
      },
      notBuilt: {
        title: 'Non ancora costruito',
        copy: 'Eseguire i passaggi in parallelo, i timeout di esecuzione, i limiti di ritentativo e i limiti di risorse per esecuzione non sono configurabili. Un flusso di lavoro esegue i suoi passaggi nell’ordine stabilito dalla validazione, fino al completamento o al fallimento, con il tempo e la memoria che il computer gli concede.',
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
        },
      },
      table: {
        title: 'Ogni componente, e cosa può raggiungere',
        headers: {
          component: 'Componente',
          version: 'Versione',
          source: 'Origine',
          canReach: 'Può raggiungere',
        },
        kind: {
          core: 'incluso di base',
          thirdParty: 'di terze parti',
        },
        none: 'nulla',
        note: 'Nulla al di fuori di questo elenco è installato, e nulla qui può raggiungere qualcosa che la propria riga non nomina — nessun accesso arbitrario ai file, nessuna shell, nessuna rete oltre a quanto elencato.',
      },
      capabilityLabels: {
        fsRead: 'Leggere i file',
        fsWrite: 'Scrivere i file',
        netHttp: 'Usare la rete',
        systemNotify: 'Mostrare notifiche',
        systemClipboard: 'Usare gli appunti',
      },
      installMore: {
        title: 'Installa altro',
        installFromFile: {
          label: 'Installa da un file',
          hint: 'Aggiungi un componente di terze parti a questa versione.',
        },
        note: 'La sandbox in cui questi componenti verrebbero eseguiti è progettata e documentata ma non ancora costruita, quindi al momento non si può installare nulla oltre ai {count} elencati sopra.',
      },
    },

    security: {
      title: 'Modello dei permessi',
      copy: 'Un componente non può accedere ai tuoi file, alla tua rete o agli appunti a meno che il suo manifesto non lo dichiari e tu non lo consenta — una volta per esecuzione. Ogni richiesta, consentita o rifiutata, viene registrata dove puoi leggerla.',
      thirdParty: {
        label: 'Componenti di terze parti',
        hint: 'Se qualcosa al di fuori di questa versione può essere installato ed eseguito.',
        status: 'Non ancora possibile — la sandbox non è costruita',
      },
      allowedInOpenWorkflow: {
        label: 'Consentito nel flusso di lavoro aperto',
        hint: 'Cancellato non appena questa applicazione si chiude.',
        nothingAllowed: 'Nulla consentito',
        allowed: '{count} consentiti',
      },
      fullDetail: {
        label: 'Dettaglio completo',
        hint: 'Cosa è stato consentito, a cosa, e da cosa questo non protegge.',
      },
    },

    privacy: {
      collect: {
        title: 'Cosa potrebbe raccogliere questa applicazione, e non raccoglie',
        telemetry: {
          label: 'Telemetria',
          hint: 'Dati di utilizzo — quali funzioni vengono usate, e quanto spesso — inviati a un server perché un team potesse dare priorità al proprio lavoro.',
        },
        crashReports: {
          label: 'Segnalazioni di arresto anomalo',
          hint: 'Uno stack trace e una versione di build, inviati automaticamente quando qualcosa fallisce, così da poterlo correggere senza che tu debba segnalarlo.',
        },
        analytics: {
          label: 'Analisi di utilizzo',
          hint: 'Conteggi delle funzionalità, durata della sessione, o qualsiasi altra cosa che trasformasse il modo in cui usi questa applicazione in un numero sulla dashboard di qualcun altro.',
        },
        note: 'Tutte e tre richiederebbero un server a cui inviare i dati. Non ce n’è uno — un interruttore "off" qui implicherebbe un meccanismo che non esiste.',
      },
      account: {
        title: 'Account',
        signIn: {
          label: 'Accesso',
          hint: 'Un’identità legata a questa applicazione, come la maggior parte dei software con server ne richiede una.',
          status: 'Nessuno — non c’è un server a cui accedere',
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

    notifications: {
      window: {
        title: 'In questa finestra',
        toast: {
          label: 'Notifiche',
          hint: 'Un flusso di lavoro può chiedere di mostrarne una, usando la stessa capacità system.notify di qualsiasi altro permesso — dichiarata nel suo manifesto e consentita prima che appaia qualcosa.',
          shown: '{count} mostrate in questa sessione',
        },
        note: 'Vengono conservate fino alle 20 più recenti finché la finestra è aperta; ignorarle svuota l’elenco. Chiudere l’applicazione le dimentica, come tutto ciò che non è un progetto salvato.',
      },
      notBuilt: {
        title: 'Non ancora costruito',
        copy: 'Non c’è un permesso di notifica del sistema operativo, né e-mail, né notifiche push — nulla ti raggiunge al di fuori di questa finestra. Non è costruita nemmeno una cronologia delle notifiche precedenti alla sessione attuale.',
      },
    },

    files: {
      disk: {
        title: 'Cosa vive sul disco',
        projects: {
          term: 'Progetti',
          detail:
            'file, ovunque tu scelga di salvarli — vedi Progetti per la cartella predefinita.',
        },
        preferences: {
          term: 'Preferenze',
          detail:
            'Archiviazione del browser nell’origine propria di questa applicazione, non un file che puoi aprire direttamente.',
        },
        componentData: {
          term: 'Dati dei componenti',
          detail:
            'Nessuno. Ogni componente di questa versione è compilato al suo interno; nulla viene scaricato o memorizzato nella cache.',
        },
        logs: {
          term: 'Registri',
          detail:
            'Nessuno scritto sul disco. Un registro di esecuzione è tenuto in memoria finché la finestra è aperta e viene eliminato alla chiusura.',
        },
      },
      notBuilt: {
        title: 'Non ancora costruito',
        copy: 'Non c’è importazione o esportazione delle impostazioni, né un modo per spostare le preferenze tra computer se non impostarle di nuovo lì. Un progetto in sé è già portatile — è un solo file — ma le preferenze di questa schermata non lo sono.',
      },
    },

    updates: {
      thisBuild: {
        title: 'Questa versione',
        channel: {
          label: 'Come una più recente arriva su questo computer',
          hint: 'Cosa succede quando esce una nuova versione.',
          fact: 'Nessun canale di aggiornamento. Aggiornare significa scaricare un installer nuovo e installarlo sopra questo.',
        },
      },
      verify: {
        title: 'Verificare cosa installi',
        copy: 'Le versioni non sono firmate digitalmente, quindi Windows avviserà di un editore non riconosciuto — un avviso corretto, dato che nulla qui dimostra chi ha prodotto il file. Ogni versione pubblica invece un hash SHA-256, per verificare un installer prima di eseguirlo.',
      },
      notBuilt: {
        title: 'Non ancora costruito',
        copy: 'Il controllo automatico degli aggiornamenti, i canali di aggiornamento come meccanismo funzionante e i download in background non sono costruiti. Oggi, controllare se c’è una nuova versione significa farlo a mano.',
      },
    },

    account: {
      title: 'Nessun account',
      copy: 'Non c’è accesso, non c’è account, e non c’è un server con cui parlare. Nulla qui ha un abbonamento, un piano, una sessione, o un elenco di dispositivi da gestire — ogni progetto e ogni preferenza di questa schermata vive su questo computer, e solo su questo computer.',
    },

    developer: {
      internals: {
        title: 'Dettagli interni',
        developerMode: {
          label: 'Modalità sviluppatore',
          hint: 'Mostra i valori grezzi delle preferenze e un riepilogo compatto di ogni componente caricato, qui sotto.',
        },
      },
      currentPreferences: {
        title: 'Preferenze attuali',
      },
      loadedComponents: {
        title: 'Componenti caricati',
      },
      hidden: {
        title: 'Nascosto per ora',
        copy: 'Attiva la modalità sviluppatore qui sopra per vedere i valori grezzi delle preferenze e un riepilogo di ogni componente caricato.',
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

    diagnostics: {
      rows: {
        version: 'Versione di Encastra',
        runtime: 'Runtime',
        protocolSchema: 'Schema del protocollo dei componenti',
        projectSchema: 'Schema del formato di progetto',
        components: 'Componenti installati',
        platform: 'Piattaforma',
        architecture: 'Architettura',
        gpu: 'GPU',
        userAgent: 'User agent del WebView',
        gpuUnknown: 'Non rilevabile',
        platformUnknown: 'Sconosciuta',
        architectureUnknown: 'Non riportata dal WebView',
      },
      machine: {
        title: 'Questo computer e questa versione',
      },
      share: {
        title: 'Condividilo',
        copy: {
          label: 'Copia',
          hint: 'Copia negli appunti tutte le righe qui sopra.',
          button: 'Copia',
          copied: 'Copiato',
          failed: 'Impossibile copiare',
        },
        export: {
          label: 'Esporta',
          hint: 'Salva lo stesso report come file di testo.',
          button: 'Esporta…',
        },
        note: 'Nulla qui include un percorso di progetto, un valore di preferenza, o un token — è pensato per poter essere incollato senza rischi in un posto pubblico. Il rapporto viene copiato ed esportato in inglese, così chiunque nel progetto può leggerlo.',
      },
    },

    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Crea software con parti che si incastrano davvero.',
      },
      thisBuild: {
        title: 'Questa versione',
        componentProtocol: {
          label: 'Protocollo dei componenti',
          hint: 'Cosa deve rispettare il manifesto di un componente per essere caricato.',
        },
        projectFormat: {
          label: 'Formato del progetto',
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
