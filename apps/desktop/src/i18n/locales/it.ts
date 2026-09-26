/**
 * Italiano. Ogni chiave qui deve esistere anche in inglese — lo verifica `i18n.test.ts`. Una
 * chiave mancante ricade semplicemente sull'inglese; una traduzione incerta non viene inclusa.
 */

import type { Messages } from '../index';

const it: Messages = {
  common: {
    close: 'Chiudi',
    dismiss: 'Ignora',
    choose: 'Scegli…',
    itCannot: 'Non può',
    recordingBadge: 'registrazione',
    projectFileType: 'Progetto Encastra',
  },

  sidebar: {
    ariaLabel: 'Sezioni',
    running: ', in esecuzione',
    items: {
      home: 'Home',
      builder: 'Builder',
      library: 'Libreria',
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
      library: {
        title: 'Apri dalla tua libreria',
        detail: 'Quello che hai creato, ricevuto o preparato',
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
    controls: {
      panel: 'Controlli della tela',
      zoomIn: 'Ingrandisci',
      zoomOut: 'Riduci',
      fitView: 'Adatta alla vista',
      minimap: 'Minimappa',
    },
    ariaLabel: 'Tela del flusso di lavoro',
    refusal: {
      selfCycle: {
        headline: 'Un passaggio non può alimentare se stesso.',
        detail:
          'Un flusso di lavoro procede in avanti. Per ripetere lo stesso lavoro più volte, avvialo da un trigger — Osserva cartella o Timer — che lo esegue una volta per ogni evento.',
      },
      bridge: 'Un passaggio che produce {bridge} nel mezzo li collegherebbe.',
      // Ogni formulazione con cui si costruisce un rifiuto — vedi `canvas/refusal.ts`.
      cannotFeed: '{from} non può entrare in un passaggio che si aspetta {to}.',
      rawType: '«{name}»',
      listOf: 'un elenco di valori di tipo {item}',
      optional: 'un valore facoltativo di tipo {item}',
      types: {
        bool: 'un booleano',
        i64: 'un numero intero',
        f64: 'un numero',
        string: 'del testo',
        json: 'del JSON',
        file: 'un file',
        dir: 'una cartella',
        bytes: 'dei byte',
        image: 'un’immagine',
        video: 'un video',
        audio: 'dell’audio',
      },
      nouns: {
        bool: 'booleano',
        i64: 'numero intero',
        f64: 'numero',
        string: 'testo',
        json: 'JSON',
        file: 'file',
        dir: 'cartella',
        bytes: 'byte',
        image: 'immagine',
        video: 'video',
        audio: 'audio',
      },
      labels: {
        bool: 'Booleano',
        i64: 'Intero',
        f64: 'Numero',
        string: 'Testo',
        json: 'JSON',
        file: 'File',
        dir: 'Cartella',
        bytes: 'Byte',
        image: 'Immagine',
        video: 'Video',
        audio: 'Audio',
      },
      detail: {
        notAType: '«{name}» non è qualcosa che questa versione sappia leggere come tipo.',
        listsDoNotMatch: 'I due elenchi non contengono la stessa cosa. {inner}',
        cannotConnect: '{from} non può essere collegato a {to}.',
        unknownType:
          '«{name}» non è un tipo che questo motore conosca. Il componente potrebbe richiedere una versione più recente.',
        siblings:
          '{from} e {to} sono due tipi di {shared}, ma uno non è l’altro. Converti passando per {shared} se è questo che intendi.',
        noConversion: '{from} non può diventare {to}. Non esiste alcuna conversione tra i due.',
      },
    },
    empty: {
      heading: 'La tua tela è vuota',
      body: 'Un flusso di lavoro è composto da pochi componenti collegati tra loro. Scegline uno a sinistra per posizionare il tuo primo passaggio, collega la sua uscita al successivo e premi Esegui.',
      hint: 'Ogni componente indica cosa può raggiungere prima di essere eseguito, e nulla tocca i tuoi file finché non lo permetti.',
    },
    // The menu a right-click opens on the canvas. Removing a step was always possible from
    // the keyboard; this is where somebody finds out that it is.
    menu: {
      label: 'Azioni della tela',
      connect: 'Connetti da qui…',
      duplicate: 'Duplica',
      disable: 'Disattiva',
      enable: 'Attiva',
      deleteStep: 'Elimina il passaggio',
      deleteConnection: 'Elimina la connessione',
      paste: 'Incolla',
      selectAll: 'Seleziona tutto',
      undo: 'Annulla',
      redo: 'Ripeti',
      many: {
        duplicate: {
          one: 'Duplica {count} passaggio',
          other: 'Duplica {count} passaggi',
        },
        disable: {
          one: 'Disattiva {count} passaggio',
          other: 'Disattiva {count} passaggi',
        },
        enable: {
          one: 'Attiva {count} passaggio',
          other: 'Attiva {count} passaggi',
        },
        delete: {
          one: 'Elimina {count} passaggio',
          other: 'Elimina {count} passaggi',
        },
      },
    },
    keysHint:
      'Usa le frecce per spostarti tra i passaggi, Invio per aprire un passaggio nell’ispettore, C per iniziare una connessione dal passaggio selezionato, E per scorrere le connessioni che ha già, Canc per rimuovere ciò che è selezionato ed Esc per lasciarlo.',
    connect: {
      started:
        'Connessione da {from}. {targets}. Frecce per scegliere, Invio per connettere, Esc per annullare.',
      targets: {
        one: '{count} destinazione possibile',
        other: '{count} destinazioni possibili',
      },
      connected: 'Connesso.',
      cancelled: 'Annullato.',
      noTargets: 'Nulla su questa tela può ricevere ciò che produce {step}.',
      noOutputs: '{step} non produce nulla da cui connettere.',
    },
    connection: {
      focused: 'Connessione da {from} a {to}.',
      removed: 'Connessione rimossa.',
      none: '{step} non ha ancora connessioni.',
    },
    a11y: {
      selected: '{name}, passaggio {index} di {total}, selezionato.',
      port: '{step} · {port}',
    },
    node: {
      notInstalled: 'Non installato.',
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
        toText: 'come testo',
        intToFloat: 'come decimale',
        boolToInt: 'come numero',
        intToBool: 'come sì/no',
        round: 'arrotondato',
        parseInt: 'analizza come numero',
        parseFloat: 'analizza come decimale',
        parseBool: 'analizza come sì/no',
        parseJson: 'analizza JSON',
        stringifyJson: 'come testo',
        encodeJson: 'in JSON',
        decodeJson: 'da JSON',
        readBytes: 'leggi',
        writeTemp: 'su file',
        unwrapOption: 'può essere assente',
        map: 'ciascuno',
      },
    },
  },

  publish: {
    heading: 'Preparare una pubblicazione',
    intro:
      'Encastra legge il progetto salvato come lo leggerebbe chi lo riceve, poi lo scrive in una cartella che scegli tu, insieme al documento che lo accompagnerebbe. Non viene caricato nulla: non esiste un registro a cui inviarlo, né un account con cui inviarlo.',
    saveFirst: 'Salva prima il progetto. Ciò che si pubblica è il file, e ancora non esiste.',
    saveChangesFirst:
      'Salva prima le modifiche. Ciò che si pubblica è il file su disco, e non corrisponde più alla tela.',
    sections: {
      about: 'Che cos’è',
      check: 'Che cosa ha trovato Encastra',
      done: 'Dove è finito',
    },
    fields: {
      title: {
        label: 'Nome',
        hint: 'Come si chiama nella pagina in cui qualcuno decide.',
      },
      summary: {
        label: 'Riepilogo',
        hint: 'Una o due frasi: che cosa fa e per chi.',
      },
      namespace: {
        label: 'Il tuo spazio dei nomi',
        hint: 'Un nome di dominio invertito che controlli, come dev.tuonome. Nessuno lo ha verificato — non ci sono account — quindi è un’affermazione, non una prova.',
      },
      version: {
        label: 'Versione',
        hint: 'Numerata come 1.0.0. Una versione pubblicata non cambia mai; una modifica riceve un numero nuovo.',
      },
      kind: {
        label: 'Tipo',
        hint: 'Un progetto è pensato per essere eseguito. Un modello per essere smontato e cambiato.',
      },
      licence: {
        label: 'Licenza',
        hint: 'Che cosa può farne qualcun altro. Una parte la cui licenza è in conflitto con questa viene rifiutata.',
      },
    },
    kinds: {
      project: 'Progetto',
      template: 'Modello',
    },
    licences: {
      mit: 'MIT',
      'apache-2.0': 'Apache-2.0',
      'gpl-3.0-only': 'GPL-3.0-only',
      proprietary: 'Tutti i diritti riservati',
    },
    derivedName: 'Sarebbe conosciuto come',
    freeOnly:
      'Gratuito, e soltanto gratuito. Non c’è un fornitore di pagamenti né un account da addebitare: un prezzo qui sarebbe un numero che nulla potrebbe incassare.',
    checking: 'Lettura del progetto…',
    checkAgain: 'Controlla di nuovo',
    prepare: 'Prepara…',
    nothingFound: 'Niente qui impedirebbe di pubblicarlo.',
    notAnAudit:
      'Questo trova gli errori abbastanza meccanici da poter essere trovati. Non è una verifica di sicurezza, e nessuno ne ha fatta una.',
    capabilities: {
      none: 'Non chiede nulla al di fuori di sé.',
      some: 'A chi lo installa viene chiesto, a ogni esecuzione, prima che possa usare:',
    },
    preparedInto: 'Il progetto e il suo documento di pubblicazione sono qui:',
    nowhereToSend: 'Restano su questo computer. Non c’è ancora nessun posto dove mandarli.',
    problems: {
      namespaceMissing: 'Una pubblicazione ha bisogno di uno spazio dei nomi.',
      namespaceShape: 'Uno spazio dei nomi è un dominio invertito, come dev.tuonome.',
      titleMissing: 'Una pubblicazione ha bisogno di un nome.',
      titleUnusable: 'Questo nome non ha lettere né numeri con cui costruire un identificatore.',
      summaryMissing: 'Una pubblicazione ha bisogno di un riepilogo.',
      summaryShort: 'Poche parole non dicono nulla a chi deve decidere. Di’ che cosa fa.',
      versionShape: 'Una versione si numera come 1.0.0.',
    },
  },
  library: {
    preparedNotOpenable:
      'Una pubblicazione preparata è una cartella da consegnare a qualcuno, non un progetto da aprire. Apri invece il progetto da cui è nata.',
    heading: 'La tua libreria',
    intro:
      'Tutto quello che hai: i progetti che hai creato, quelli che hai ricevuto da qualcun altro e le cartelle che hai preparato per consegnarle. È tutto su questo computer. Niente viene sincronizzato, caricato o condiviso.',
    import: 'Importa…',
    importTitle: 'Leggi una cartella di pubblicazione che ti hanno dato',
    importUnavailable: 'Richiede l’applicazione desktop',
    search: {
      placeholder: 'Cerca',
      ariaLabel: 'Cerca nella tua libreria',
    },
    sort: {
      label: 'Ordine',
      name: 'Per nome',
      recent: 'Più recente',
      origin: 'Per provenienza',
    },
    noMatches: 'Qui non c’è niente che corrisponda.',
    quarantined:
      'L’elenco precedente non era leggibile, così è stato messo da parte con il nome {name} e ne è stato iniziato uno nuovo. Non è stato cancellato niente e nessuno dei tuoi progetti è stato toccato.',
    origin: {
      created: 'Creato qui',
      imported: 'Importato',
      prepared: 'Preparato',
    },
    status: {
      missing: {
        label: 'Non c’è',
        detail:
          'Nel punto indicato non c’è più niente. Il file è stato spostato o cancellato fuori da Encastra, cosa che puoi fare: questa riga è vecchia, non sbagliata.',
      },
      changed: {
        label: 'Cambiato',
        detail:
          'Il file c’è, ma il contenuto è diverso da quando Encastra l’ha guardato l’ultima volta. Qualcosa l’ha modificato altrove.',
      },
    },
    facts: {
      version: 'Versione',
      publisher: 'Editore',
      steps: 'Passi',
      when: 'Ultima volta',
    },
    row: {
      opened: 'Aperto il {when}',
      added: 'Aggiunto il {when}',
      publisherClaim:
        '{publisher}: è quello che dichiara, non è verificato. Non ci sono account, quindi nessuno l’ha controllato.',
      steps: {
        one: '{count} passo',
        other: '{count} passi',
      },
    },
    reach: {
      none: 'Non chiede niente fuori da sé.',
      someLabel: 'Chiederà di raggiungere:',
      asksEveryRun: 'Averlo qui non concede niente di tutto questo. Ogni esecuzione lo chiede.',
    },
    actions: {
      open: 'Apri',
      remove: 'Rimuovi…',
    },
    remove: {
      cancel: 'Tieni',
      keepsFile:
        'Questo lo toglie solo dall’elenco. Il tuo file resta esattamente dove l’hai messo.',
      forget: 'Toglilo dall’elenco',
      importedNote:
        'Questa copia l’ha fatta Encastra, quindi può cancellarla. Scegli tu: la copia se ne va, oppure resta dov’è.',
      andDeleteCopy: 'Rimuovi e cancella la copia',
      keepCopy: 'Rimuovi, tieni la copia',
      refused:
        'Quel file è tuo e resta dov’è. Encastra cancella solo le copie che ha fatto lei stessa.',
    },
    empty: {
      heading: 'Qui non c’è ancora niente',
      body: 'In questo elenco finiscono tre cose, e ognuna comincia da qualcosa che fai tu.',
      ways: {
        created: 'Un progetto che salvi viene aggiunto.',
        imported:
          'Una cartella di pubblicazione che ti hanno dato viene aggiunta quando la importi, dopo che Encastra l’ha letta e tu hai detto di sì.',
        prepared: 'Una cartella che prepari per consegnarla viene aggiunta quando la prepari.',
      },
      build: 'Costruisci qualcosa',
      buildTitle: 'Apri il builder e parti da una tela vuota',
    },
  },

  import: {
    heading: 'Ricevere una pubblicazione',
    intro:
      'Encastra ha letto la cartella che hai scelto come dovrebbe leggerla chi la riceve: ha confrontato il file con il documento che lo accompagna e ha rifatto qui lo stesso controllo dell’editore. Non è stato scritto niente e non è stato eseguito niente.',
    reading: 'Sto leggendo la cartella…',
    writing: 'Copia in corso nella tua libreria. Non ci vorrà molto.',
    confirm: 'Importa',
    nothing: 'niente',
    copiesNothingRuns:
      'Importare copia i file nella tua libreria. Non viene eseguito niente finché non lo apri e premi Esegui.',
    nothingWasTakenIn: 'Non è stato ricevuto niente e su questo computer non è cambiato niente.',
    sections: {
      what: 'Che cosa dice di essere',
      integrity: 'Se il file è quello descritto',
      inside: 'Che cosa c’è dentro',
      asks: 'Che cosa chiederebbe',
      check: 'Che cosa ha trovato Encastra',
    },
    facts: {
      publisher: 'Editore',
      name: 'Si chiama',
      version: 'Versione',
      kind: 'Tipo',
      licence: 'Licenza',
      size: 'Dimensione',
      kilobytes: '{size} kB',
      runtime: 'Gira su',
      projectName: 'Progetto',
      steps: 'Passi',
      stepCount: {
        one: '{count} passo',
        other: '{count} passi',
      },
      switchedOff: ' ({count} spenti)',
      versions: 'Versioni conservate',
      versionCount: {
        one: '{count} versione',
        other: '{count} versioni',
      },
    },
    kinds: {
      project: 'Progetto',
      template: 'Modello',
      component: 'Componente',
    },
    notVerified:
      'Nessuno ha verificato che questo editore sia chi dice il nome. Non ci sono account, quindi non c’è nessuno che avrebbe potuto farlo.',
    checksumMatches:
      'Il file corrisponde al codice di controllo scritto nel documento che lo accompagna.',
    checksumIsNotProvenance:
      'Questo dimostra che il file non è stato alterato da quando è stato preparato. Non dice niente su chi l’ha preparato.',
    capabilities: {
      none: 'Non chiede niente fuori da sé.',
      some: 'Quando viene eseguito chiederà di usare:',
      grantsNothing:
        'Importare non concede niente di tutto questo. Ogni esecuzione chiede prima di toccare qualcosa.',
    },
    nothingFound: 'Qui non c’è niente che impedisca di riceverlo.',
    notAnAudit:
      'Questo trova gli errori abbastanza meccanici da poter essere trovati. Non è un audit di sicurezza, e nessuno ne ha fatto uno.',
    disagreement: {
      declared: 'Il documento dice',
      actual: 'Il progetto chiede',
    },
    tokens: {
      title: 'titolo',
      summary: 'riassunto',
      changelog: 'elenco delle modifiche',
      publisher: 'editore',
      categories: 'categorie',
      tags: 'etichette',
      runtime: 'motore di esecuzione',
    },
    errors: {
      notAFolder:
        'Quella non è una cartella. Una pubblicazione è una cartella con dentro un progetto e il documento che lo descrive.',
      folderIsALink:
        'Quella cartella è un collegamento a un altro posto. Encastra non lo segue, perché altrimenti quello che legge e quello che hai scelto non sarebbero la stessa cosa. Scegli la cartella vera.',
      folderNotChosen:
        'Quella cartella non è stata scelta in questa sessione. Selezionala con il selettore di cartelle, così che ciò che Encastra legge sia ciò che hai indicato.',
      noDocument:
        'In quella cartella non c’è nessun publication.json, quindi niente dice che cosa sia. È una cartella di file, non una pubblicazione.',
      documentIsALink:
        'publication.json è un collegamento a un altro file, non un file. Encastra legge quello che c’è nella cartella che hai scelto e niente fuori da lì.',
      documentTooLarge:
        'publication.json occupa circa {size} kB e questa versione ne legge al massimo {max} kB. Un documento di pubblicazione è una pagina di testo; uno così grande non lo è.',
      documentUnreadable:
        'Non è stato possibile leggere publication.json: {reason}. Chiedi a chi l’ha preparato di rifarlo.',
      noProject:
        'In quella cartella non c’è nessun file .encastra. Una pubblicazione è un progetto e il documento che lo descrive.',
      moreThanOneProject:
        'Una pubblicazione è un solo progetto, e quella cartella ne contiene {count}: {names}. Chi l’ha preparata dovrebbe mandare una cartella per progetto.',
      projectIsALink:
        'Il file del progetto è un collegamento a un altro file, non un file. Encastra installa quello che c’è nella cartella che hai scelto e niente fuori da lì.',
      unexpectedEntries:
        'Una cartella di pubblicazione contiene un documento e un progetto, e niente altro. Questa contiene anche {names}. Encastra non riceve una cartella di cui non può rendere conto.',
      tooManyEntries:
        "Una cartella di pubblicazione contiene un documento e un progetto, e nient'altro. Questa ne contiene più di {max}, e non è una pubblicazione qualunque cosa siano.",
      projectTooLarge:
        'Il progetto occupa circa {size} kB e questa versione ne installa al massimo {max} kB.',
      checksumMismatch:
        'Il file del progetto non è quello descritto da questa pubblicazione. O il documento descrive un altro file, o il file è cambiato per strada. Chiedilo di nuovo.',
      projectUnreadable:
        'Non è stato possibile leggere il file del progetto: {reason}. Potrebbe averlo fatto una versione più recente di Encastra, o potrebbe essersi danneggiato per strada.',
      notInstallable:
        'Questa versione non sa installare un {publicationKind}, e non farà finta di saperlo.',
      notAListingId:
        '«{id}» non è un nome di pubblicazione, quindi non c’è un nome sicuro sotto cui archiviarlo.',
      notAVersion: '«{version}» non è una versione. Le pubblicazioni si numerano come 1.2.0.',
      notPublishersNamespace:
        '«{listing}» non è nello spazio dei nomi di {publisher}. Il documento nomina un editore e una pubblicazione che appartiene a un altro, ed Encastra non può sapere quale dei due sia l’errore.',
      textTooLong:
        'Il campo {field} è più lungo di quello che questa versione legge (al massimo {max} caratteri).',
      textHasControlCharacters:
        'Il campo {field} contiene caratteri che possono nascondere quello che dice davvero: quelli che fanno sembrare un nome un altro. Encastra lo rifiuta invece di riscrivere in silenzio quello che qualcuno ha scritto.',
      documentDisagreesWithProject:
        'Il documento e il progetto non concordano sul {about}. La pagina che descrive questa cosa sta descrivendo qualcosa di diverso dal file che la accompagna.',
      runtimeIncompatible:
        'Questa pubblicazione è per un motore {requires}, e questo è {have}. Non si installa niente per una versione per cui non è stato costruito.',
      reviewRefused:
        'Lo stesso controllo fatto dal suo editore lo rifiuta qui. Questo dovrebbe cambiare prima che qualcuno possa riceverlo:',
      capabilitiesDisagree:
        'Il documento e il progetto non concordano su che cosa chiede questa cosa. Dichiarare meno permessi del vero è il problema ovvio; dichiararne di più insegna alla gente a leggere l’elenco di sfuggita, che è quello più sottile. Vengono rifiutati entrambi.',
      alreadyImported:
        '{listing} {version} è già nella tua libreria. Una versione pubblicata non cambia mai, quindi qui non c’è niente di nuovo da ricevere.',
      libraryFull:
        'La tua libreria è piena. Contiene già circa {used} MB di copie importate e questa versione ne conserva al massimo {max} MB; questa ne richiede circa {needed} MB. Rimuovi qualcosa che non usi più e riprova: non è stato importato nulla.',
      io: 'Qualcosa su questo computer ha rifiutato l’operazione ({reason}). Non è stato ricevuto niente.',
      unknown:
        'Encastra ha rifiutato questa cartella per un motivo che questa versione non sa esprimere a parole. Non è stata ricevuta.',
    },
  },

  toolbar: {
    publish: 'Pubblica',
    publishTitle: 'Preparare questo progetto perché qualcun altro lo installi',
    preview: {
      badge: 'anteprima',
      title: 'Nessun runtime è collegato a questa finestra.',
    },
    new: 'Nuovo',
    open: 'Apri',
    save: 'Salva',
    unsavedChanges: 'Modifiche non salvate',
    check: 'Controlla',
    stop: 'Interrompi',
    run: 'Esegui',
    startWatching: 'Inizia a osservare',
    watching: 'In osservazione',
    recordedRuns: {
      everythingAllowed: 'Registrato: tutto consentito',
      folderNotAllowed: 'Registrato: la cartella non è stata consentita',
    },
    notifications: {
      more: '{count} in più',
    },
    status: {
      steps: {
        one: '{count} passaggio',
        other: '{count} passaggi',
      },
      running: 'in esecuzione',
      runs: {
        one: '{count} esecuzione',
        other: '{count} esecuzioni',
      },
      waiting: '{count} in attesa',
      ok: {
        one: '{count} riuscito',
        other: '{count} riusciti',
      },
      failed: {
        one: '{count} fallito',
        other: '{count} falliti',
      },
      skipped: {
        one: '{count} saltato',
        other: '{count} saltati',
      },
    },
  },

  components: {
    categories: {
      all: 'Tutti',
      other: 'Altro',
      data: 'Dati',
      file: 'File',
      flow: 'Flusso',
      media: 'Media',
      network: 'Rete',
      system: 'Sistema',
    },
    core: {
      encastra: {
        data: {
          csv: {
            read: {
              name: 'Leggi CSV',
              description: 'Trasforma un testo separato da virgole in un elenco di righe.',
            },
            write: {
              name: 'Scrivi CSV',
              description: 'Trasforma un elenco di righe in testo separato da virgole.',
            },
          },
          json: {
            name: 'Analizza JSON',
            description: 'Trasforma il testo in dati strutturati.',
            write: {
              name: 'Scrivi JSON',
              description: 'Ritrasforma i dati strutturati in testo.',
            },
          },
        },
        file: {
          move: {
            name: 'Sposta file',
            description: 'Sposta un file in un’altra cartella. L’originale viene rimosso.',
          },
          read: {
            name: 'Leggi file',
            description: 'Legge il contenuto testuale del file collegato.',
          },
          rename: {
            name: 'Rinomina file',
            description: 'Dà un nuovo nome a un file, lasciandolo dov’è.',
          },
          save: {
            name: 'Salva file',
            description:
              'Mette un file in una cartella a tua scelta. Mantiene il nome originale, a meno che tu non ne indichi un altro.',
          },
          watch: {
            name: 'Osserva cartella',
            description:
              'Avvia il flusso di lavoro ogni volta che un file compare in una cartella.',
          },
          write: {
            name: 'Scrivi file',
            description: 'Salva del testo in un file, in una cartella a tua scelta.',
          },
        },
        flow: {
          delay: {
            name: 'Ritardo',
            description: 'Attende, poi passa il valore senza modificarlo.',
          },
          if: {
            name: 'Se',
            description: 'Invia il valore da una parte o dall’altra in base a una condizione.',
          },
          switch: {
            name: 'Smistamento',
            description: 'Invia il valore lungo uno di diversi percorsi in base a una parola.',
          },
        },
        image: {
          convert: {
            name: 'Converti immagine',
            description: 'Scrive un’immagine in un formato diverso.',
          },
          info: {
            name: 'Info immagine',
            description: 'Riporta dimensioni e formato di un’immagine senza modificarla.',
          },
          resize: {
            name: 'Ridimensiona immagine',
            description:
              'Cambia le dimensioni di un’immagine. Lascia vuoto un lato per mantenere le proporzioni.',
          },
          thumbnail: {
            name: 'Miniatura',
            description: 'Crea una piccola anteprima quadrata di un’immagine.',
          },
        },
        net: {
          http: {
            name: 'Richiesta HTTP',
            description: 'Recupera un indirizzo web, o gli invia dei dati.',
          },
        },
        system: {
          clipboard: {
            name: 'Copia negli appunti',
            description: 'Mette il testo negli appunti, pronto da incollare.',
          },
          notify: {
            name: 'Notifica',
            description: 'Mostra un messaggio quando questo passaggio viene eseguito.',
          },
          timer: {
            name: 'Timer',
            description: 'Avvia il flusso di lavoro più e più volte, secondo una pianificazione.',
          },
        },
      },
    },
    header: {
      title: 'Componenti',
      summary: {
        one: '{count} installato.',
        other: '{count} installati.',
      },
      summaryWithTriggers: {
        one: '{count} installati — {triggerCount} di essi avvia un flusso di lavoro per conto proprio; il resto viene eseguito come passaggio all’interno di uno.',
        other:
          '{count} installati — {triggerCount} di essi avviano un flusso di lavoro per conto proprio; il resto viene eseguito come passaggio all’interno di uno.',
      },
      note: 'Tutto questo è incluso con l’applicazione; installarne altri richiede la sandbox per il codice di terze parti, che non è ancora costruita.',
    },
    search: {
      placeholder: 'Cerca',
      ariaLabel: 'Cerca componenti',
    },
    filters: {
      categoryLegend: 'Categoria',
    },
    empty: 'Nulla corrisponde.',
    card: {
      triggerBadge: 'avvia un flusso di lavoro',
      triggerNote:
        'Una fonte di eventi, non un passaggio — questo avvia un’esecuzione invece di essere eseguito all’interno di una.',
      noDescription: 'Questo componente non ha documentato cosa fa.',
      takes: 'Prende',
      gives: 'Restituisce',
      addToCanvas: 'Aggiungi alla tela',
    },
    reach: {
      label: 'Può raggiungere',
      none: 'Non raggiunge nulla al di fuori di questo flusso di lavoro',
      verb: {
        fsRead: 'Legge i file',
        fsWrite: 'Scrive i file',
        netHttp: 'Usa la rete',
        systemClipboard: 'Usa gli appunti',
        systemNotify: 'Mostra notifiche',
      },
      cannot: {
        fsRead: 'leggere i tuoi file',
        fsWrite: 'scrivere file',
        netHttp: 'usare la rete',
        systemClipboard: 'usare gli appunti',
        systemNotify: 'mostrare notifiche',
      },
    },
  },

  security: {
    title: 'Sicurezza',
    intro:
      'I componenti non possono accedere ai tuoi file, alla tua rete o agli appunti a meno che un manifesto non lo dichiari e tu non lo consenta. I permessi vengono concessi per ogni esecuzione, e ogni richiesta — consentita o rifiutata — viene registrata dove puoi leggerla.',
    installed: {
      title: 'Componenti installati',
      headers: {
        component: 'Componente',
        version: 'Versione',
        origin: 'Origine',
        canReach: 'Può raggiungere',
      },
      builtIn: 'incluso di fabbrica',
      nothing: 'nulla',
      thirdPartyNote:
        'Nulla qui proviene dall’esterno di questa applicazione. I componenti di terze parti verrebbero eseguiti in una sandbox WebAssembly senza autorità ambientale; quella sandbox è progettata e documentata, ma {notBuilt}, quindi installarli non è ancora possibile.',
      thirdPartyNoteEmphasis: 'non è costruita',
    },
    grants: {
      title: 'Consentito nel flusso di lavoro aperto',
      empty:
        'Non è stato consentito nulla. Un flusso di lavoro che ha bisogno di una cartella lo chiederà prima di essere eseguito.',
      note: 'Questi durano solo per questa sessione. Chiudere l’applicazione li fa dimenticare, quindi un flusso di lavoro che non guardi da un mese non può continuare a scrivere da qualche parte.',
    },
    privacy: {
      title: 'Privacy',
      telemetry: { label: 'Telemetria', value: 'Nessuna. Non viene raccolto né inviato nulla.' },
      crashReports: { label: 'Segnalazioni di arresto anomalo', value: 'Nessuna.' },
      accounts: { label: 'Account', value: 'Nessuno. Non c’è né accesso né server.' },
      yourFiles: {
        label: 'I tuoi file',
        value:
          'Non lasciano mai questo computer, a meno che un flusso di lavoro che hai creato non li invii da qualche parte.',
      },
      runJournals: {
        value:
          'Registrano dimensioni e forme, mai il contenuto dei file. Un registro viene tenuto in memoria finché la finestra è aperta e visibile; nulla viene scritto su disco, e chiudere l’applicazione lo elimina.',
      },
    },
    limits: {
      title: 'Da cosa questo non protegge',
      misuse:
        'Un componente a cui consenti un accesso ampio può abusarne. La finestra di dialogo può rendere questa scelta informata; non può renderla impossibile.',
      trustedBase:
        'I componenti inclusi di fabbrica vengono eseguiti come normale codice nativo. Sono vincolati dal mediatore dei permessi, ma un bug in uno di essi è un bug nella base fidata.',
      noAudit:
        'Questa versione non ha avuto alcuna verifica di sicurezza esterna. È un prerequisito per distribuire componenti scritti da altre persone, non per eseguire i tuoi flussi di lavoro.',
      unsigned:
        'Nulla qui è ancora firmato, quindi questa versione non può dimostrare di non essere stata alterata.',
      previewOnly: 'Questa è un’anteprima nel browser, senza alcun runtime collegato.',
    },
    footer:
      'Runtime {runtime} · schema del protocollo {protocolSchema} · schema del progetto {projectSchema}',
  },

  inspector: {
    problemsTitle: 'Problemi',
    projectTitle: 'Progetto',
    selectStep: 'Seleziona un passaggio per configurarlo, o scegli un componente per iniziare.',
    component: 'Componente',
    switchOn: 'Attiva',
    switchOff: 'Disattiva',
    settingsTitle: 'Impostazioni',
    nothingChosen: 'Nulla scelto',
    entryInputs: {
      title: 'Materiale di partenza',
      doc: 'Nulla nel grafo produce questo, quindi l’esecuzione ne ha bisogno da te.',
    },
    permissions: {
      title: 'Permessi',
      none: 'Questo componente non richiede nulla. Lavora solo con ciò che il grafo gli passa, e non può accedere ai tuoi file, alla rete o agli appunti.',
      allowed: 'Consentito',
      allowFolder: 'Consenti questa cartella',
      allowHost: 'Consenti {host}',
      allowAddress: 'Consenti questo indirizzo',
      allow: 'Consenti',
      scope:
        'Consentito finché questo progetto resta aperto. Ogni esecuzione usa esattamente questa cartella o questo indirizzo, e chiudere il progetto o cambiarlo lo dimentica.',
      chooseFolderFirst: 'Scegli prima una cartella.',
      enterAddressFirst: 'Inserisci prima un indirizzo.',
      notASetting:
        'Non è un’impostazione — il componente non lo ha mai dichiarato, quindi il runtime lo rifiuta qualunque cosa tu consenta qui.',
    },
    versions: {
      title: 'Versioni',
      titleWithCount: 'Versioni · {count}',
      empty:
        'Salva questo progetto per iniziare a conservare versioni. Ogni salvataggio ne registra una, e nulla viene mai sovrascritto.',
      currentVersionTitle: 'Questa è la versione attuale.',
      restoreTitle: 'Ripristina questa. Viene aggiunta come nuova versione; nulla va perso.',
      current: 'Attuale',
      versionNumber: 'Versione {number}',
      restore: 'Ripristina',
    },
    runRecord: {
      title: 'Ultima esecuzione',
      code: 'Codice: {code}',
      neverRan: 'Questo passaggio non è mai stato eseguito, perché {name} non è terminato.',
      status: 'Stato',
      took: 'Durata',
      in: 'in {port}',
      out: 'fuori {port}',
      permissionsUsed: 'Permessi usati',
      refused: ' · {count} rifiutati',
      logs: 'Registro',
    },
  },

  runPanel: {
    ariaLabel: 'Esecuzione',
    title: 'Esecuzione',
    recordingTitle:
      'Questa è un’esecuzione registrata, riprodotta per il debugger. Non è appena avvenuta su questo computer.',
    empty:
      'Non è ancora stato eseguito nulla. Premi Esegui qui sopra e ogni passaggio apparirà qui, nell’ordine in cui il runtime li esegue, con il suo stato e quanto ha impiegato — oppure, se uno fallisce, cosa è andato storto e cosa fare.',
    status: {
      pending: 'In attesa',
      running: 'In esecuzione',
      ok: 'Terminato',
      failed: 'Fallito',
      skipped: 'Saltato',
      cancelled: 'Annullato',
      disabled: 'Disattivato',
    },
    outcome: {
      watching: 'Osservazione dei cambiamenti…',
      running: 'Esecuzione in corso…',
      finished: 'Terminato.',
      finishedIn: 'Terminato in {took}.',
      partial: {
        one: '{count} passaggio è fallito. Il resto del grafo è comunque stato eseguito.',
        other: '{count} passaggi sono falliti. Il resto del grafo è comunque stato eseguito.',
      },
      failed: 'Nulla è stato completato.',
      cancelled: 'Interrotto.',
    },
    watch: {
      runsSoFar: {
        one: '{count} esecuzione finora',
        other: '{count} esecuzioni finora',
      },
      pendingWaiting: '{count} in attesa',
    },
    step: {
      neverRan: 'Mai eseguito — {name} non è terminato.',
    },
  },

  onboarding: {
    tour: {
      stepCount: 'Passaggio {current} di {total}',
      done: 'Fatto — continua quando sei pronto.',
      waiting: 'In attesa che tu lo provi.',
      finish: 'Fine',
      next: 'Avanti',
      canvas: {
        title: 'Questa è la tua tela',
        body: 'Un flusso di lavoro è composto da pochi componenti collegati tra loro. Tutto viene eseguito su questo computer, e nulla accede ai tuoi file finché non lo permetti.',
      },
      addFirst: {
        title: 'Aggiungi il primo passaggio',
        body: 'A sinistra c’è ogni componente installato. Trova Osserva cartella e aggiungilo — avvia il flusso di lavoro ogni volta che appare un file dove scegli tu.',
      },
      addSecond: {
        title: 'Aggiungi qualcosa da fare',
        body: 'Ora aggiungi Ridimensiona immagine. Prende un’immagine e ne fa una copia più piccola, lasciando intatta l’originale.',
      },
      connect: {
        title: 'Collegali tra loro',
        body: 'Trascina dalla porta file di Osserva cartella alla porta immagine di Ridimensiona immagine. Un file non è ancora un’immagine, quindi l’editor inserisce il passaggio che lo apre — e rifiuta subito il collegamento se i due non potrebbero mai combaciare.',
      },
      configure: {
        title: 'Digli quale cartella',
        body: 'Seleziona un passaggio per configurarlo a destra. Osserva cartella deve sapere quale cartella osservare, e Salva file deve sapere dove mettere il risultato.',
      },
      allow: {
        title: 'Consentigli quella cartella',
        body: 'Un componente non può toccare nulla finché non glielo dici, e un permesso è limitato all’unica cartella che scegli. Premi Consenti sul passaggio che lo ha chiesto.',
      },
      run: {
        title: 'Eseguilo',
        body: 'Premi Esegui, oppure Ctrl+Invio. Ogni passaggio si illumina man mano che avviene, e il pannello sotto registra cosa ha fatto e quanto ci ha messo.',
      },
    },
    welcome: {
      title: 'Benvenuto in Encastra',
      lead: 'Crea software assemblando componenti. Scegli le parti, le colleghi e premi esegui — su questo computer, senza che nulla acceda ai tuoi file finché non lo permetti.',
      createFirst: {
        title: 'Crea il tuo primo flusso di lavoro',
        note: 'Un breve percorso guidato, circa un minuto',
      },
      exploreSample: {
        title: 'Esplora un esempio',
        note: '{name}, già costruito — scegli tu le sue cartelle',
      },
      skip: {
        title: 'Salta',
        note: 'Vai dritto al punto. Lo trovi nelle Impostazioni se lo vuoi più tardi.',
      },
    },
  },

  // L’unica domanda che questa applicazione pone prima di scartare del lavoro.
  unsaved: {
    title: 'Modifiche non salvate',
    reasons: {
      new: 'Hai modifiche non salvate. Iniziare un nuovo progetto le perderebbe.',
      open: 'Hai modifiche non salvate. Aprire un altro progetto le perderebbe.',
      demo: 'Hai modifiche non salvate. Caricare un esempio le perderebbe.',
      restore: 'Hai modifiche non salvate. Ripristinare una versione precedente le perderebbe.',
      close: 'Hai modifiche non salvate. Chiudere Encastra le perderebbe.',
      'library-open':
        'Hai modifiche non salvate. Aprire qualcosa dalla tua libreria le perderebbe.',
    },
    save: 'Salva e continua',
    discard: 'Scarta le modifiche',
    cancel: 'Annulla',
  },
  messages: {
    untitledProject: 'Senza titolo',
    recordingNote: 'Questa è una registrazione, non un’esecuzione su questo computer.',
    problemsToFix: {
      one: '{count} problema da risolvere.',
      other: '{count} problemi da risolvere.',
    },
    readyToRun: 'Questo grafo è pronto per essere eseguito.',
    nothingRanProblems: {
      one: 'Nulla è stato eseguito: {count} problema da risolvere prima.',
      other: 'Nulla è stato eseguito: {count} problemi da risolvere prima.',
    },
    saved: {
      one: 'Salvato. {count} versione conservata.',
      other: 'Salvato. {count} versioni conservate.',
    },
    watchingChanges: 'In osservazione. Verrà eseguito non appena appare qualcosa.',
    running: 'In esecuzione.',
    stopping: 'Interruzione in corso.',
    demoLoaded: '{name}: compila {needs}, poi avvialo.',
    restored: 'Ripristinato. La versione da cui provenivi è ancora nella cronologia.',
    missingComponents: 'Questo progetto ha bisogno di {missing}, che non è installato.',
    runtimeSilent: 'Qualcosa nel runtime non ha risposto.',
    libraryMissing:
      '{name} non è più dov’era. Rimettilo a posto, oppure aprilo da dove si trova adesso.',
    imported: 'Ricevuto {name}. Non è stato eseguito niente.',
    removedFromLibrary: '{name} non è più nell’elenco. Il file è rimasto dov’era.',
    importInFlight:
      'È in corso la scrittura di un’importazione. La finestra si chiuderà al termine.',
    removedAndDeleted:
      '{name} non è più nell’elenco, e la copia fatta da Encastra è stata cancellata.',
  },

  errors: {
    unknown:
      'Encastra ha rifiutato per un motivo che questa versione non sa nominare ({kind}). Non è stato modificato nulla.',
    runtimeBusy: 'Il motore è occupato con altro. Riprova tra un momento.',
    libraryBusy: 'La tua libreria è occupata. Riprova tra un momento.',
    importInFlight:
      'È in corso la scrittura di un’importazione. La finestra si chiuderà quando avrà finito.',
    chooserDidNotReturn:
      'Il selettore di cartelle si è chiuso senza rispondere. Non è stato scelto nulla.',
    notAFolderOnThisMachine:
      'Quello che il selettore ha restituito non è una cartella di questo computer.',
    notAFileOnThisMachine: 'Quello non è un file su questa macchina.',
    fileUnusable: 'Quel file non può essere usato: {reason}.',
    folderUnusable: 'Quella cartella non può essere usata ({reason}).',
    notAProject: 'Questo non è un progetto Encastra. Il nome di un progetto finisce con .encastra.',
    versionNotInProject:
      'Quella versione non è in questo progetto. La sua cronologia potrebbe essere cambiata dall’ultima volta che l’hai vista.',
    versionsNotInProject:
      'Una di quelle due versioni non è in questo progetto, quindi non c’è nulla da confrontare.',
    grantsRefused: 'Non è stato eseguito nulla. {count} dei permessi concessi non sono stati dati:',
    workingFolder:
      'Encastra non è riuscito a preparare una cartella di lavoro per questa esecuzione ({reason}). Non è stato eseguito nulla.',
    inputUnreadable: 'Non è stato possibile aprire {path} ({reason}). Non è stato eseguito nulla.',
    inputUnusable:
      'Il file per {node}.{port} non può essere usato: {reason}. Non è stato eseguito nulla.',
    inputNotChosen:
      'Scegli il file per {node}.{port} con il pulsante Scegli prima di eseguire. Non è stato eseguito nulla.',
    workflowAlreadyRunning: 'C’è già un flusso in esecuzione. Fermalo prima di avviarne un altro.',
    workflowInvalid:
      'Questo flusso non può ancora essere eseguito: {problems} cosa/e da sistemare prima.',
    workflowNotStarted:
      'Non è stato possibile avviare il flusso ({reason}). Non è stato eseguito nulla.',
    destinationMissing: 'Quella cartella non c’è. Scegline una che esista.',
    destinationIsALink:
      'Quella cartella è un collegamento a un altro punto, quindi ciò che viene scritto finirebbe altrove rispetto a dove hai scelto. Scegli la cartella stessa.',
    destinationIsAFile:
      'Quello è un file, non una cartella. Una pubblicazione ha bisogno di una cartella propria.',
    destinationNotChosen:
      'Scegli prima la cartella di pubblicazione con il pulsante Scegli, così Encastra scrive dove hai indicato.',
    publicationPathEscapes:
      'Quella pubblicazione non può essere scritta dove è stato chiesto. Non è stato scritto nulla.',
    publicationAlreadyThere:
      '{folder} contiene già una pubblicazione. Eliminala oppure scegli un’altra cartella.',
    notOursToDelete:
      'Quel file è tuo e resta dov’è. Encastra elimina solo le copie che ha fatto lui, cioè le cose che hai importato.',
    copyNotDeleted: 'Non è più nel tuo elenco, ma la copia non è stata eliminata ({reason}).',
    noWindow: 'Non c’è nessuna finestra da chiudere.',
    windowWouldNotClose: 'La finestra non si è chiusa. Il tuo lavoro è ancora qui.',
    io: 'Qualcosa su questo computer ha rifiutato l’operazione ({reason}).',
    status: {
      triggerError: '{node} ha smesso di sorvegliare i cambiamenti. {reason}',
      eventsDropped: {
        one: 'È stato scartato {count} evento: arrivava più in fretta di quanto si potesse gestire.',
        other:
          'Sono stati scartati {count} eventi: arrivavano più in fretta di quanto si potesse gestire.',
      },
      workflowStopped: 'Questo flusso si è fermato in modo imprevisto. Puoi riavviarlo.',
      runningFor: {
        one: 'In esecuzione da {seconds} secondo.',
        other: 'In esecuzione da {seconds} secondi.',
      },
    },
    // Perché un passaggio di un'esecuzione è fallito, nella lingua di chi legge.
    // L'elenco dei codici vive in `crates/encastra-core/src/journal.rs`.
    node: {
      missingInput: 'A questo passaggio manca un ingresso. Collega un passaggio che lo produca.',
      wrongInput:
        'Questo passaggio ha ricevuto un tipo di valore che non sa gestire. Controlla che cosa è collegato.',
      missingConfig:
        'Manca un’impostazione obbligatoria di questo passaggio. Compilala nel passaggio stesso.',
      missingHandle:
        'Il valore consegnato a questo passaggio non è più disponibile. Esegui di nuovo il flusso.',
      notText:
        'Quel file non è testo leggibile da questa versione. Collegalo invece a un passaggio che lavora con i byte.',
      notAnImage:
        'Quel file non è stato letto come immagine. Verifica che ciò che è collegato lo sia davvero.',
      conversionFailed:
        'Non è stato possibile convertire un valore in ciò che si aspetta il passaggio successivo. Collega tipi compatibili, oppure aggiungi un passaggio che li converta.',
      conversionUnavailable:
        'Questa versione non sa ancora fare quella conversione. Le serve un componente non ancora pubblicato.',
      invalidJson: 'Quel testo non è JSON valido, quindi non c’è nulla da leggerci.',
      invalidCsv:
        'Quel file non è stato letto come tabella. Una riga o l’intestazione non rispetta il separatore indicato in questo passaggio.',
      badSeparator:
        'Il separatore deve essere un solo carattere: una virgola, un punto e virgola o una tabulazione.',
      csvTooLarge:
        'Quella tabella ha più righe o celle di quante questa versione ne trasformi in dati. Dividi il file, oppure filtralo prima di questo passaggio.',
      encodeFailed: 'Il risultato non è stato scritto nel formato prodotto da questo passaggio.',
      resizeFailed:
        'Non è stato possibile ridimensionare quell’immagine. Potrebbe essere danneggiata, o più grande di quanto questa versione gestisca.',
      unsupportedFormat:
        'Questa versione non sa scrivere quel formato di immagine. Scegli PNG, JPEG o WebP.',
      badUrl:
        'Quell’indirizzo non è utilizzabile. Deve somigliare a https://esempio.com/percorso, senza nome utente né password.',
      insecureUrl:
        'Quell’indirizzo usa http in chiaro, che lungo il percorso può essere letto e modificato. Usa https, oppure attiva «Consenti http in chiaro» se sai che l’indirizzo è sicuro.',
      unsupportedMethod: 'Questo passaggio non invia quel tipo di richiesta.',
      requestFailed:
        'La richiesta non è arrivata. Controlla l’indirizzo e che questa macchina possa raggiungerlo.',
      responseTooLarge:
        'La risposta era più grande di quanto legga questa versione. Le risposte oltre 16 MB vengono rifiutate.',
      denied:
        'Questo passaggio ha chiesto qualcosa che non gli è consentito. Concedilo nei permessi del passaggio, poi esegui di nuovo.',
      readFailed:
        'Qualcosa su questo computer non è stato letto. Potrebbe essere stato spostato, o la macchina non lo consente.',
      writeFailed:
        'Il risultato non è stato scritto su questo computer. Verifica che la cartella esista e che tu possa scriverci.',
      moveIncomplete:
        'Il file è stato copiato, ma l’originale non è stato rimosso. Nella destinazione ora c’è una copia: elimina tu l’originale se volevi spostarlo.',
      tooLarge:
        'Quel file è più grande di quanto legga questa versione. Non è stato letto nulla. Usa un file più piccolo, oppure dividilo prima di questo passaggio.',
      clipboardUnavailable:
        'Qui non ci sono appunti da usare. Succede su macchine senza sessione desktop, come un server di build.',
      clipboardFailed:
        'Gli appunti non hanno accettato ciò che questo passaggio voleva metterci. Non è stato copiato nulla.',
      cancelled: 'Questo passaggio è stato fermato prima di finire.',
      runTooLong:
        'L’esecuzione ha superato il limite di tempo ed è stata fermata. Ciò che era finito è nel registro.',
      runMemoryBudget:
        'Questo passaggio porterebbe l’esecuzione oltre quanto può trattenere insieme, perciò è stato rifiutato. Lavora i file uno alla volta, oppure passali così come sono invece di leggerli come testo.',
      componentMissing:
        'Il componente usato da questo passaggio non è installato. Importalo, oppure rimuovi il passaggio.',
      noImplementation:
        'Quel componente si descrive ma non ha codice in questa versione. I componenti in sandbox non sono ancora eseguibili.',
      contractBroken:
        'Il componente ha prodotto qualcosa di diverso da ciò che dichiara, perciò il risultato non è stato trasmesso.',
    },
    grant: {
      folderUnusable: '{node}: quella cartella non può essere usata ({reason}).',
      folderNotChosen:
        '{node}: scegli quella cartella con il pulsante Scegli prima di consentirla, così ciò che viene consentito è ciò che hai indicato.',
      notDeclared:
        '{node}: questo passo non chiede mai {capability}, quindi non c’è nulla da consentire.',
    },
    project: {
      generic: 'Non è stato possibile leggere quel file di progetto.',
      unsupportedSchema:
        'Questa versione legge progetti nella versione {ours}, e quello dichiara la versione {theirs}. È stato creato da un Encastra più recente.',
      missingEntry: 'Il file di progetto non contiene {entry}, quindi non è un progetto completo.',
      invalid: '{entry}, dentro quel progetto, non è valido: {reason}.',
      archive:
        'Il file di progetto non è leggibile come archivio ({reason}). Potrebbe essere danneggiato.',
      tooLarge:
        '{entry}, dentro quel progetto, si espande oltre ciò che questa versione legge ({limit} byte).',
      tooLargeInTotal:
        'Quel progetto si espande oltre ciò che questa versione legge ({limit} byte in tutto).',
      tooManySnapshots:
        'Quel progetto conserva {count} versioni, e questa build ne tiene al massimo {limit}.',
      fileTooLarge:
        'Quel file di progetto occupa {size} byte, e questa versione ne legge al massimo {limit}.',
      ambiguousArchive:
        'L’archivio del progetto elenca {declared} voci con soli {distinct} nomi, quindi nomina qualcosa due volte. Encastra non indovina quale fosse.',
      io: 'Il file di progetto non è stato letto né scritto ({reason}).',
    },
    library: {
      generic: 'Non è stato possibile leggere la tua libreria.',
      corrupt:
        'L’indice della tua libreria non è leggibile ({reason}). È stato lasciato esattamente com’è: è il registro del tuo lavoro, ed Encastra non lo ricomincia da capo.',
      writtenByAnotherVersion:
        'L’indice della tua libreria è stato scritto da un’altra versione di Encastra (dichiara la versione {theirs}, e questa legge la {ours}). È stato lasciato com’è.',
      tooManyEntries:
        'L’indice della tua libreria elenca {count} cose, e questa versione ne tiene al massimo {max}. È stato lasciato com’è.',
      notOurs: 'Non è Encastra ad averlo messo lì, quindi non è Encastra a toglierlo.',
      io: 'La tua libreria non è stata letta né scritta ({reason}).',
    },
    bundle: {
      generic: 'Non è stato possibile preparare quella pubblicazione.',
      reviewRefused:
        'Il controllo ha trovato {blocking} cosa/e da cambiare prima che questo possa essere pubblicato.',
      notAVersion: '«{version}» non è una versione. Le pubblicazioni si numerano come 1.2.0.',
      notYourNamespace:
        '«{listing}» non è dentro lo spazio dei nomi di {publisher}. Una pubblicazione viene archiviata sotto il nome di chi la pubblica.',
      missing: 'A una pubblicazione serve: {field}.',
      tooLong:
        'Il campo {field} è più lungo di quanto questa versione pubblichi (al massimo {max} caratteri).',
      controlCharacters:
        'Il campo {field} contiene caratteri che possono nascondere ciò che dice davvero. Encastra lo rifiuta invece di riscrivere in silenzio ciò che hai scritto.',
      tooLarge: 'Quel progetto occupa circa {size}, e questa versione pubblica al massimo {max}.',
      notInstallable:
        'Questa versione non può installare {publicationKind}, quindi non lo propone.',
      notAnIdentifier: '«{value}» non è un nome utilizzabile: {why}.',
    },
    import: {
      generic:
        'Quella pubblicazione non è stata acquisita, e su questo computer non è cambiato nulla.',
    },
  },

  demos: {
    imageProcessor: {
      name: 'Elaboratore di immagini',
      summary:
        'Osserva una cartella. Ogni volta che appare un’immagine, ne crea una copia più piccola in un’altra cartella.',
      needs: {
        watch: 'Una cartella da osservare',
        save: 'Una cartella in cui salvare',
      },
    },
    fileOrganiser: {
      name: 'Organizzatore di file',
      summary:
        'Osserva una cartella e sposta ciò che vi arriva in una di altre tre, in base al tipo di file.',
      needs: {
        watch: 'Una cartella da osservare',
        images: 'Una cartella per le immagini',
        documents: 'Una cartella per i documenti',
      },
    },
    thumbnails: {
      name: 'Miniature',
      summary:
        'Trasforma una cartella di immagini in anteprime quadrate, pronte per una galleria o una griglia.',
      needs: {
        watch: 'Una cartella da osservare',
        save: 'Una cartella in cui salvare',
      },
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
          label: 'Non tradotto',
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
          connectFromStep: 'Inizia una connessione dal passaggio selezionato, sulla tela',
          cycleConnections: 'Scorre le connessioni del passaggio selezionato, sulla tela',
          deleteConnection: 'Elimina la connessione selezionata, sulla tela',
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
          confirm: {
            question:
              'Ripristinare tutte le impostazioni di questa schermata? I tuoi progetti, i permessi concessi e i componenti installati non vengono toccati.',
            confirm: 'Sì, ripristina',
            cancel: 'Annulla',
          },
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
          failed: 'Impossibile salvare il rapporto. Usa Copia al suo posto.',
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
