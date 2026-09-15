/**
 * Português (europeu). Toda chave aqui também deve existir em inglês — verificado por
 * `i18n.test.ts`. Uma chave em falta recorre simplesmente ao inglês; uma tradução incerta não é
 * incluída.
 */

import type { Messages } from '../index';

const pt: Messages = {
  common: {
    close: 'Fechar',
    dismiss: 'Dispensar',
    choose: 'Escolher…',
    itCannot: 'Não consegue',
    recordingBadge: 'gravação',
  },

  sidebar: {
    ariaLabel: 'Secções',
    running: ', em execução',
    items: {
      home: 'Início',
      builder: 'Construtor',
      library: 'Biblioteca',
      components: 'Componentes',
      security: 'Segurança',
      settings: 'Definições',
    },
  },

  home: {
    intro: {
      heading: 'Crie software a partir de peças que encaixam.',
      body: 'Coloque componentes numa tela, ligue-os e prima iniciar. Tudo corre nesta máquina, e nada acede aos seus ficheiros sem que lhe seja pedido primeiro.',
    },
    actions: {
      new: {
        title: 'Novo fluxo de trabalho',
        detail: 'Começar a partir de uma tela vazia',
      },
      open: {
        title: 'Abrir',
        detailReady: 'Um ficheiro .encastra guardado anteriormente',
        detailUnavailable: 'Requer a aplicação de ambiente de trabalho',
      },
      library: {
        title: 'Abrir da sua biblioteca',
        detail: 'O que fez, recebeu ou preparou',
      },
      browse: {
        title: 'Explorar componentes',
        detail: {
          one: '{count} instalado, e o que consegue alcançar',
          other: '{count} instalados, e o que cada um consegue alcançar',
        },
      },
    },
    continue: {
      heading: 'Onde ficou',
      steps: {
        one: '{count} passo',
        other: '{count} passos',
      },
      unsaved: ' · ainda não guardado',
    },
    samples: {
      heading: 'Exemplos',
      note: 'Fluxos de trabalho reais sobre o motor de execução real. Cada um precisa que escolha as suas pastas antes de poder começar — um exemplo que escrevesse num sítio que não tinha escolhido seria exactamente o oposto do objectivo.',
      needs: 'Precisa de: {list}',
    },
  },

  palette: {
    title: 'Componentes',
    empty: 'Não há componentes instalados.',
    asksTo: 'Pede para: {list}',
    capabilities: {
      fsRead: 'ler ficheiros',
      fsWrite: 'escrever ficheiros',
      netHttp: 'usar a rede',
      systemNotify: 'mostrar notificações',
      systemClipboard: 'usar a área de transferência',
    },
  },

  canvas: {
    ariaLabel: 'Tela do fluxo de trabalho',
    refusal: {
      selfCycle: {
        headline: 'Um passo não se pode alimentar a si próprio.',
        detail:
          'Um fluxo de trabalho corre para a frente. Para repetir o mesmo trabalho várias vezes, inicie-o a partir de um gatilho — Vigiar pasta ou Temporizador — que o executa uma vez por cada evento.',
      },
      bridge: 'Um passo que produzisse {bridge} pelo meio uniria os dois.',
      // Cada formulação com que se constrói uma recusa — ver `canvas/refusal.ts`.
      cannotFeed: '{from} não pode entrar num passo que espera {to}.',
      rawType: '«{name}»',
      listOf: 'uma lista de valores do tipo {item}',
      optional: 'um valor opcional do tipo {item}',
      types: {
        bool: 'um booleano',
        i64: 'um número inteiro',
        f64: 'um número',
        string: 'texto',
        json: 'JSON',
        file: 'um ficheiro',
        dir: 'uma pasta',
        bytes: 'bytes',
        image: 'uma imagem',
        video: 'um vídeo',
        audio: 'áudio',
      },
      nouns: {
        bool: 'booleano',
        i64: 'número inteiro',
        f64: 'número',
        string: 'texto',
        json: 'JSON',
        file: 'ficheiro',
        dir: 'pasta',
        bytes: 'bytes',
        image: 'imagem',
        video: 'vídeo',
        audio: 'áudio',
      },
      labels: {
        bool: 'Booleano',
        i64: 'Inteiro',
        f64: 'Número',
        string: 'Texto',
        json: 'JSON',
        file: 'Ficheiro',
        dir: 'Pasta',
        bytes: 'Bytes',
        image: 'Imagem',
        video: 'Vídeo',
        audio: 'Áudio',
      },
      detail: {
        notAType: '«{name}» não é algo que esta versão saiba ler como um tipo.',
        listsDoNotMatch: 'As duas listas não contêm o mesmo. {inner}',
        cannotConnect: '{from} não pode ligar-se a {to}.',
        unknownType:
          '«{name}» não é um tipo que este motor conheça. O componente pode precisar de uma versão mais recente.',
        siblings:
          '{from} e {to} são dois tipos de {shared}, mas um não é o outro. Converta através de {shared} se é isso que quer dizer.',
        noConversion: '{from} não pode tornar-se {to}. Não existe conversão entre os dois.',
      },
    },
    empty: {
      heading: 'A sua tela está vazia',
      body: 'Um fluxo de trabalho é composto por alguns componentes ligados entre si. Escolha um à esquerda para colocar o seu primeiro passo, ligue a sua saída ao seguinte e prima Executar.',
      hint: 'Cada componente indica o que consegue alcançar antes de ser executado, e nada toca nos seus ficheiros até que o permita.',
    },
    // The menu a right-click opens on the canvas. Removing a step was always possible from
    // the keyboard; this is where somebody finds out that it is.
    menu: {
      label: 'Ações da tela',
      connect: 'Ligar a partir daqui…',
      duplicate: 'Duplicar',
      disable: 'Desligar',
      enable: 'Ligar',
      deleteStep: 'Eliminar o passo',
      deleteConnection: 'Eliminar a ligação',
      paste: 'Colar',
      selectAll: 'Seleccionar tudo',
      undo: 'Desfazer',
      redo: 'Refazer',
      many: {
        duplicate: {
          one: 'Duplicar {count} passo',
          other: 'Duplicar {count} passos',
        },
        disable: {
          one: 'Desligar {count} passo',
          other: 'Desligar {count} passos',
        },
        enable: {
          one: 'Ligar {count} passo',
          other: 'Ligar {count} passos',
        },
        delete: {
          one: 'Eliminar {count} passo',
          other: 'Eliminar {count} passos',
        },
      },
    },
    keysHint:
      'Use as setas para se mover entre passos, Enter para abrir um passo no inspector, C para começar uma ligação a partir do passo seleccionado, E para percorrer as ligações que já tem, Delete para remover o que estiver seleccionado e Escape para largar.',
    connect: {
      started:
        'A ligar a partir de {from}. {targets}. Setas para escolher, Enter para ligar, Escape para cancelar.',
      targets: {
        one: '{count} destino possível',
        other: '{count} destinos possíveis',
      },
      connected: 'Ligado.',
      cancelled: 'Cancelado.',
      noTargets: 'Nada nesta tela pode receber o que {step} produz.',
      noOutputs: '{step} não produz nada a partir do qual ligar.',
    },
    connection: {
      focused: 'Ligação de {from} para {to}.',
      removed: 'Ligação removida.',
      none: '{step} ainda não tem ligações.',
    },
    a11y: {
      selected: '{name}, passo {index} de {total}, seleccionado.',
      port: '{step} · {port}',
    },
    node: {
      notInstalled: 'Não instalado.',
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
        toText: 'como texto',
        intToFloat: 'como decimal',
        boolToInt: 'como número',
        intToBool: 'como sim/não',
        round: 'arredondado',
        parseInt: 'analisar como número',
        parseFloat: 'analisar como decimal',
        parseBool: 'analisar como sim/não',
        parseJson: 'analisar JSON',
        stringifyJson: 'como texto',
        encodeJson: 'para JSON',
        decodeJson: 'a partir de JSON',
        readBytes: 'ler',
        writeTemp: 'para ficheiro',
        unwrapOption: 'pode estar ausente',
        map: 'cada um',
      },
    },
  },

  publish: {
    heading: 'Preparar uma publicação',
    intro:
      'O Encastra lê o projecto guardado como o leria quem o recebe e depois escreve-o numa pasta à sua escolha, juntamente com o documento que o acompanharia. Nada é enviado: não há registo para onde o enviar nem conta com que o enviar.',
    saveFirst: 'Guarde primeiro o projecto. O que se publica é o ficheiro, e ainda não existe.',
    saveChangesFirst:
      'Guarde primeiro as alterações. O que se publica é o ficheiro no disco, e já não corresponde à tela.',
    sections: {
      about: 'O que isto é',
      check: 'O que o Encastra encontrou',
      done: 'Onde ficou',
    },
    fields: {
      title: {
        label: 'Nome',
        hint: 'Como se chama na página a partir da qual alguém decide.',
      },
      summary: {
        label: 'Resumo',
        hint: 'Uma ou duas frases: o que faz e para quem.',
      },
      namespace: {
        label: 'O seu espaço de nomes',
        hint: 'Um nome de domínio invertido que controle, como dev.oseunome. Ninguém o verificou — não há contas —, por isso é uma afirmação, não uma prova.',
      },
      version: {
        label: 'Versão',
        hint: 'Numerada como 1.0.0. Uma versão publicada nunca muda; uma alteração recebe um número novo.',
      },
      kind: {
        label: 'Tipo',
        hint: 'Um projecto destina-se a ser executado. Um modelo, a ser desmontado e alterado.',
      },
      licence: {
        label: 'Licença',
        hint: 'O que outra pessoa pode fazer com isto. Uma parte cuja licença entre em conflito com esta é recusada.',
      },
    },
    kinds: {
      project: 'Projecto',
      template: 'Modelo',
    },
    licences: {
      mit: 'MIT',
      'apache-2.0': 'Apache-2.0',
      'gpl-3.0-only': 'GPL-3.0-only',
      proprietary: 'Todos os direitos reservados',
    },
    derivedName: 'Seria conhecido como',
    freeOnly:
      'Gratuito, e apenas gratuito. Não há fornecedor de pagamentos nem conta a quem cobrar, por isso um preço aqui seria um número que nada poderia cobrar.',
    checking: 'A ler o projecto…',
    checkAgain: 'Verificar de novo',
    prepare: 'Preparar…',
    nothingFound: 'Nada aqui impediria a publicação.',
    notAnAudit:
      'Isto encontra os erros suficientemente mecânicos para serem encontrados. Não é uma auditoria de segurança, e ninguém fez nenhuma.',
    capabilities: {
      none: 'Não pede nada fora de si mesmo.',
      some: 'A quem o instalar é perguntado, em cada execução, antes de poder usar:',
    },
    preparedInto: 'O projecto e o seu documento de publicação estão aqui:',
    nowhereToSend: 'Ficam nesta máquina. Ainda não há para onde os enviar.',
    problems: {
      namespaceMissing: 'Uma publicação precisa de um espaço de nomes.',
      namespaceShape: 'Um espaço de nomes é um domínio invertido, como dev.oseunome.',
      titleMissing: 'Uma publicação precisa de um nome.',
      titleUnusable: 'Este nome não tem letras nem números com que construir um identificador.',
      summaryMissing: 'Uma publicação precisa de um resumo.',
      summaryShort: 'Umas poucas palavras não dizem nada a quem decide. Diga o que faz.',
      versionShape: 'Uma versão numera-se como 1.0.0.',
    },
  },
  library: {
    preparedNotOpenable:
      'Uma publicação preparada é uma pasta para entregar a alguém, não um projeto para abrir. Abra o projeto de que ela foi feita.',
    heading: 'A sua biblioteca',
    intro:
      'Tudo o que tem: os projetos que criou, o que recebeu de outra pessoa e as pastas que preparou para entregar. Está tudo nesta máquina. Nada é sincronizado, enviado ou partilhado.',
    import: 'Importar…',
    importTitle: 'Ler uma pasta de publicação que lhe deram',
    importUnavailable: 'Precisa da aplicação de ambiente de trabalho',
    search: {
      placeholder: 'Pesquisar',
      ariaLabel: 'Pesquisar na sua biblioteca',
    },
    sort: {
      label: 'Ordem',
      name: 'Por nome',
      recent: 'Mais recente',
      origin: 'Por proveniência',
    },
    noMatches: 'Nada aqui corresponde a isso.',
    quarantined:
      'A lista anterior não pôde ser lida, por isso foi posta de lado com o nome {name} e começou-se uma nova. Não se apagou nada e nenhum dos seus projetos foi tocado.',
    origin: {
      created: 'Feito aqui',
      imported: 'Importado',
      prepared: 'Preparado',
    },
    status: {
      missing: {
        label: 'Não está',
        detail:
          'Já não há nada no sítio para onde isto aponta. Foi movido ou apagado fora do Encastra, o que é seu direito: esta linha está desatualizada, não errada.',
      },
      changed: {
        label: 'Alterado',
        detail:
          'O ficheiro está lá, mas o conteúdo é diferente do que o Encastra viu da última vez. Algo o editou noutro sítio.',
      },
    },
    facts: {
      version: 'Versão',
      publisher: 'Editor',
      steps: 'Passos',
      when: 'Última vez',
    },
    row: {
      opened: 'Aberto a {when}',
      added: 'Adicionado a {when}',
      publisherClaim:
        '{publisher} — é o que diz ser, não está verificado. Não há contas, por isso ninguém o confirmou.',
      steps: {
        one: '{count} passo',
        other: '{count} passos',
      },
    },
    reach: {
      none: 'Não pede nada fora de si mesmo.',
      someLabel: 'Vai pedir para alcançar:',
      asksEveryRun: 'Tê-lo aqui não concede nada disto. Cada execução pergunta.',
    },
    actions: {
      open: 'Abrir',
      remove: 'Remover…',
    },
    remove: {
      cancel: 'Manter',
      keepsFile: 'Isto só o tira da lista. O seu ficheiro fica exatamente onde o pôs.',
      forget: 'Tirar da lista',
      importedNote:
        'Esta cópia foi feita pelo Encastra, por isso pode apagá-la. A escolha é sua: a cópia vai-se embora ou fica onde está.',
      andDeleteCopy: 'Remover e apagar a cópia',
      keepCopy: 'Remover, manter a cópia',
      refused:
        'Esse ficheiro é seu e fica onde está. O Encastra só apaga cópias que fez ele próprio.',
    },
    empty: {
      heading: 'Ainda não há nada aqui',
      body: 'Três coisas acabam nesta lista, e cada uma começa com algo que faz.',
      ways: {
        created: 'Um projeto que guarda é adicionado.',
        imported:
          'Uma pasta de publicação que lhe deram é adicionada quando a importa, depois de o Encastra a ler e de o utilizador dizer que sim.',
        prepared: 'Uma pasta que prepara para entregar é adicionada quando a prepara.',
      },
      build: 'Construir algo',
      buildTitle: 'Abrir o construtor e começar com uma tela vazia',
    },
  },

  import: {
    heading: 'Receber uma publicação',
    intro:
      'O Encastra leu a pasta que escolheu como deve lê-la quem a recebe: comparou o ficheiro com o documento ao lado e voltou a correr aqui a verificação do editor. Não se escreveu nada e não se executou nada.',
    reading: 'A ler a pasta…',
    writing: 'A copiar isto para a tua biblioteca. Não vai demorar.',
    confirm: 'Importar',
    nothing: 'nada',
    copiesNothingRuns:
      'Importar copia os ficheiros para a sua biblioteca. Nada é executado até o abrir e carregar em Executar.',
    nothingWasTakenIn: 'Não se recebeu nada e nada foi alterado nesta máquina.',
    sections: {
      what: 'O que diz ser',
      integrity: 'Se o ficheiro é o que está descrito',
      inside: 'O que está lá dentro',
      asks: 'O que iria pedir',
      check: 'O que o Encastra encontrou',
    },
    facts: {
      publisher: 'Editor',
      name: 'Conhecida como',
      version: 'Versão',
      kind: 'Tipo',
      licence: 'Licença',
      size: 'Tamanho',
      kilobytes: '{size} kB',
      runtime: 'Corre em',
      projectName: 'Projeto',
      steps: 'Passos',
      stepCount: {
        one: '{count} passo',
        other: '{count} passos',
      },
      switchedOff: ' ({count} desligados)',
      versions: 'Versões guardadas',
      versionCount: {
        one: '{count} versão',
        other: '{count} versões',
      },
    },
    kinds: {
      project: 'Projeto',
      template: 'Modelo',
      component: 'Componente',
    },
    notVerified:
      'Ninguém verificou que este editor é quem o nome diz. Não há contas, por isso não há ninguém que o pudesse ter feito.',
    checksumMatches: 'O ficheiro corresponde à soma de verificação do documento que o acompanha.',
    checksumIsNotProvenance:
      'Isso prova que o ficheiro não foi alterado desde que foi preparado. Não diz nada sobre quem o preparou.',
    capabilities: {
      none: 'Não pede nada fora de si mesmo.',
      some: 'Ao executar, vai pedir para usar:',
      grantsNothing:
        'Importar não concede nada disto. Cada execução pergunta antes de alcançar o que quer que seja.',
    },
    nothingFound: 'Não há aqui nada que impeça recebê-lo.',
    notAnAudit:
      'Isto encontra os erros suficientemente mecânicos para serem encontrados. Não é uma auditoria de segurança, e ninguém fez nenhuma.',
    disagreement: {
      declared: 'O documento diz',
      actual: 'O projeto pede',
    },
    tokens: {
      title: 'título',
      summary: 'resumo',
      changelog: 'lista de alterações',
      publisher: 'editor',
      categories: 'categorias',
      tags: 'etiquetas',
      runtime: 'motor de execução',
    },
    errors: {
      notAFolder:
        'Isso não é uma pasta. Uma publicação é uma pasta com um projeto e o documento que o descreve.',
      folderIsALink:
        'Essa pasta é uma ligação para outro sítio. O Encastra não a segue, porque então o que lesse e o que escolheu não seriam a mesma coisa. Escolha a própria pasta.',
      folderNotChosen:
        'Essa pasta não foi escolhida nesta sessão. Selecione-a com o seletor de pastas, para que o que o Encastra lê seja o que você apontou.',
      noDocument:
        'Não há publication.json nessa pasta, por isso nada diz o que é. Isso é uma pasta de ficheiros, não uma publicação.',
      documentIsALink:
        'publication.json é uma ligação para outro ficheiro, não um ficheiro. O Encastra lê o que está na pasta que escolheu e nada fora dela.',
      documentTooLarge:
        'publication.json ocupa cerca de {size} kB e esta versão lê no máximo {max} kB. Um documento de publicação é uma página de texto; um deste tamanho não é.',
      documentUnreadable:
        'Não foi possível ler publication.json: {reason}. Peça a quem o preparou que o prepare outra vez.',
      noProject:
        'Não há nenhum ficheiro .encastra nessa pasta. Uma publicação é um projeto e o documento que o descreve.',
      moreThanOneProject:
        'Uma publicação é um só projeto, e essa pasta tem {count}: {names}. Quem a preparou devia enviar uma pasta por projeto.',
      projectIsALink:
        'O ficheiro do projeto é uma ligação para outro ficheiro, não um ficheiro. O Encastra instala o que está na pasta que escolheu e nada fora dela.',
      unexpectedEntries:
        'Uma pasta de publicação tem um documento e um projeto, e mais nada. Esta também tem {names}. O Encastra não recebe uma pasta de que não consiga dar conta.',
      tooManyEntries:
        'Uma pasta de publicação tem um documento e um projeto, e nada mais. Esta tem mais de {max} entradas, e isso não é uma publicação sejam o que forem.',
      projectTooLarge:
        'O projeto ocupa cerca de {size} kB e esta versão instala no máximo {max} kB.',
      checksumMismatch:
        'O ficheiro do projeto não é o que esta publicação descreve. Ou o documento descreve outro ficheiro, ou o ficheiro mudou pelo caminho. Peça-o outra vez.',
      projectUnreadable:
        'Não foi possível ler o ficheiro do projeto: {reason}. Pode ter sido feito por uma versão mais recente do Encastra, ou ter-se danificado pelo caminho.',
      notInstallable:
        'Esta versão não consegue instalar um {publicationKind}, e não vai fingir que consegue.',
      notAListingId:
        '«{id}» não é um nome de publicação, por isso não há um nome seguro sob o qual arquivá-lo.',
      notAVersion: '«{version}» não é uma versão. As publicações são numeradas como 1.2.0.',
      notPublishersNamespace:
        '«{listing}» não está dentro do espaço de nomes de {publisher}. O documento nomeia um editor e uma publicação que pertence a outro, e o Encastra não consegue saber qual dos dois é o erro.',
      textTooLong:
        'O campo {field} é mais longo do que esta versão lê (no máximo {max} caracteres).',
      textHasControlCharacters:
        'O campo {field} tem caracteres que podem esconder o que realmente diz — do género que faz um nome parecer outro. O Encastra recusa-o em vez de reescrever em silêncio o que alguém escreveu.',
      documentDisagreesWithProject:
        'O documento e o projeto não concordam quanto ao {about}. A página que descreve isto está a descrever algo diferente do ficheiro ao lado.',
      runtimeIncompatible:
        'Esta publicação é para um motor {requires} e este é {have}. Não se instala nada para uma versão para a qual não foi construído.',
      reviewRefused:
        'A mesma verificação que o editor correu recusa-o aqui. Isto teria de mudar antes de alguém o poder receber:',
      capabilitiesDisagree:
        'O documento e o projeto não concordam sobre o que isto pede. Declarar permissões a menos é o problema óbvio; declarar a mais ensina as pessoas a passar os olhos pela lista, que é o mais subtil. Ambos são recusados.',
      alreadyImported:
        '{listing} {version} já está na sua biblioteca. Uma versão publicada nunca muda, por isso não há aqui nada de novo para receber.',
      libraryFull:
        'A tua biblioteca está cheia. Já guarda cerca de {used} MB de cópias importadas e esta versão mantém no máximo {max} MB; esta precisa de cerca de {needed} MB. Remove algo que já não uses e tenta de novo: não foi importado nada.',
      io: 'Algo neste computador recusou a operação ({reason}). Não se recebeu nada.',
      unknown:
        'O Encastra recusou esta pasta por um motivo para o qual esta versão não tem palavras. Não foi recebida.',
    },
  },

  toolbar: {
    publish: 'Publicar',
    publishTitle: 'Preparar este projecto para que outra pessoa o instale',
    preview: {
      badge: 'pré-visualização',
      title: 'Não há nenhum motor de execução associado a esta janela.',
    },
    new: 'Novo',
    open: 'Abrir',
    save: 'Guardar',
    unsavedChanges: 'Alterações não guardadas',
    check: 'Verificar',
    stop: 'Parar',
    run: 'Executar',
    startWatching: 'Começar a vigiar',
    watching: 'A vigiar',
    recordedRuns: {
      everythingAllowed: 'Gravação: tudo permitido',
      folderNotAllowed: 'Gravação: a pasta não foi permitida',
    },
    notifications: {
      more: '{count} mais',
    },
    status: {
      steps: {
        one: '{count} passo',
        other: '{count} passos',
      },
      running: 'em execução',
      runs: {
        one: '{count} execução',
        other: '{count} execuções',
      },
      waiting: '{count} em espera',
      ok: {
        one: '{count} concluído',
        other: '{count} concluídos',
      },
      failed: {
        one: '{count} falhado',
        other: '{count} falhados',
      },
      skipped: {
        one: '{count} ignorado',
        other: '{count} ignorados',
      },
    },
  },

  components: {
    header: {
      title: 'Componentes',
      summary: '{count} instalados.',
      summaryWithTriggers:
        '{count} instalados — {triggerCount} deles iniciam um fluxo de trabalho por conta própria; o resto executa-se como um passo dentro de um.',
      note: 'Tudo isto vem incluído com a aplicação; instalar outros precisa da sandbox para código de terceiros, que ainda não está construída.',
    },
    search: {
      placeholder: 'Pesquisar',
      ariaLabel: 'Pesquisar componentes',
    },
    filters: {
      categoryLegend: 'Categoria',
    },
    empty: 'Nada corresponde a isso.',
    card: {
      triggerBadge: 'inicia um fluxo de trabalho',
      triggerNote:
        'Uma fonte de eventos, não um passo — isto inicia uma execução em vez de se executar dentro de uma.',
      noDescription: 'Este componente não documentou o que faz.',
      takes: 'Recebe',
      gives: 'Devolve',
      addToCanvas: 'Adicionar à tela',
    },
    reach: {
      label: 'Consegue alcançar',
      none: 'Não alcança nada fora deste fluxo de trabalho',
      verb: {
        fsRead: 'Lê ficheiros',
        fsWrite: 'Escreve ficheiros',
        netHttp: 'Usa a rede',
        systemClipboard: 'Usa a área de transferência',
        systemNotify: 'Mostra notificações',
      },
      cannot: {
        fsRead: 'ler os seus ficheiros',
        fsWrite: 'escrever ficheiros',
        netHttp: 'usar a rede',
        systemClipboard: 'usar a área de transferência',
        systemNotify: 'mostrar notificações',
      },
    },
  },

  security: {
    title: 'Segurança',
    intro:
      'Os componentes não conseguem aceder aos seus ficheiros, à sua rede ou à sua área de transferência a menos que um manifesto o declare e você o permita. As permissões são concedidas por execução, e cada pedido — permitido ou recusado — fica registado onde o pode consultar.',
    installed: {
      title: 'Componentes instalados',
      headers: {
        component: 'Componente',
        version: 'Versão',
        origin: 'Origem',
        canReach: 'Consegue alcançar',
      },
      builtIn: 'incluído de fábrica',
      nothing: 'nada',
      thirdPartyNote:
        'Nada aqui vem de fora desta aplicação. Os componentes de terceiros seriam executados numa sandbox de WebAssembly sem autoridade ambiental; essa sandbox está concebida e documentada, mas {notBuilt}, por isso instalá-los ainda não é possível.',
      thirdPartyNoteEmphasis: 'não está construída',
    },
    grants: {
      title: 'Permitido no fluxo de trabalho aberto',
      empty:
        'Não foi permitido nada. Um fluxo de trabalho que precise de uma pasta vai perguntar antes de ser executado.',
      note: 'Estes duram apenas para esta sessão. Fechar a aplicação esquece-os, por isso um fluxo de trabalho que não veja há um mês não pode continuar a escrever nalgum sítio.',
    },
    privacy: {
      title: 'Privacidade',
      telemetry: { label: 'Telemetria', value: 'Nenhuma. Nada é recolhido nem enviado.' },
      crashReports: { label: 'Relatórios de falha', value: 'Nenhum.' },
      accounts: { label: 'Contas', value: 'Nenhuma. Não há início de sessão nem servidor.' },
      yourFiles: {
        label: 'Os seus ficheiros',
        value:
          'Nunca saem deste computador, a menos que um fluxo de trabalho que tenha criado os envie para algum lado.',
      },
      runJournals: {
        value:
          'Registam tamanhos e formas, nunca o conteúdo dos ficheiros. Um registo é mantido em memória enquanto a janela está aberta e visível; nada é escrito no disco, e fechar a aplicação descarta-o.',
      },
    },
    limits: {
      title: 'Contra o que isto não protege',
      misuse:
        'Um componente a que conceda um acesso amplo pode abusar dele. A caixa de diálogo pode tornar essa decisão informada; não a pode tornar impossível.',
      trustedBase:
        'Os componentes incluídos de fábrica executam-se como código nativo comum. Estão limitados pelo intermediário de permissões, mas uma falha num deles é uma falha na base de confiança.',
      noAudit:
        'Esta versão não teve nenhuma auditoria de segurança externa. Isso é um pré-requisito para distribuir componentes escritos por outras pessoas, não para executar os seus próprios fluxos de trabalho.',
      unsigned:
        'Nada aqui está assinado ainda, por isso esta versão não consegue provar que não foi alterada.',
      previewOnly:
        'Isto é uma pré-visualização no navegador, sem qualquer motor de execução associado.',
    },
    footer:
      'Motor de execução {runtime} · esquema de protocolo {protocolSchema} · esquema de projecto {projectSchema}',
  },

  inspector: {
    problemsTitle: 'Problemas',
    projectTitle: 'Projecto',
    selectStep: 'Seleccione um passo para o configurar, ou escolha um componente para começar.',
    component: 'Componente',
    switchOn: 'Ligar',
    switchOff: 'Desligar',
    settingsTitle: 'Definições',
    nothingChosen: 'Nada escolhido',
    entryInputs: {
      title: 'Material de partida',
      doc: 'Nada no grafo produz isto, por isso a execução precisa disto de si.',
    },
    permissions: {
      title: 'Permissões',
      none: 'Este componente não pede nada. Trabalha apenas com o que o grafo lhe entrega, e não consegue aceder aos seus ficheiros, à rede ou à área de transferência.',
      allowed: 'Permitido',
      allowFolder: 'Permitir esta pasta',
      allowHost: 'Permitir {host}',
      allowAddress: 'Permitir este endereço',
      allow: 'Permitir',
      scope:
        'Permitido enquanto este projeto estiver aberto. Cada execução usa exactamente esta pasta ou endereço, e fechar o projeto ou mudar de projeto esquece-o.',
      chooseFolderFirst: 'Escolha primeiro uma pasta.',
      enterAddressFirst: 'Introduza primeiro um endereço.',
      notASetting:
        'Não é uma definição — o componente nunca declarou isto, por isso o motor de execução recusa-o seja o que for que permita aqui.',
    },
    versions: {
      title: 'Versões',
      titleWithCount: 'Versões · {count}',
      empty:
        'Guarde este projecto para começar a conservar versões. Cada vez que guarda regista uma, e nada é alguma vez substituído.',
      currentVersionTitle: 'Esta é a versão actual.',
      restoreTitle: 'Restaurar esta. É adicionada como uma nova versão; nada se perde.',
      current: 'Actual',
      versionNumber: 'Versão {number}',
      restore: 'Restaurar',
    },
    runRecord: {
      title: 'Última execução',
      code: 'Código: {code}',
      neverRan: 'Este passo nunca foi executado, porque {name} não terminou.',
      status: 'Estado',
      took: 'Demorou',
      in: 'entra {port}',
      out: 'sai {port}',
      permissionsUsed: 'Permissões usadas',
      refused: ' · {count} recusadas',
      logs: 'Registos',
    },
  },

  runPanel: {
    ariaLabel: 'Execução',
    title: 'Execução',
    recordingTitle:
      'Esta é uma execução gravada, reproduzida para o depurador. Não acabou de acontecer neste computador.',
    empty:
      'Ainda não foi executado nada. Prima Executar acima e cada passo vai aparecer aqui, na ordem em que o motor de execução os executa, com o seu estado e quanto tempo demorou — ou, se um falhar, o que correu mal e o que fazer.',
    status: {
      pending: 'Em espera',
      running: 'Em execução',
      ok: 'Concluído',
      failed: 'Falhado',
      skipped: 'Ignorado',
      cancelled: 'Cancelado',
      disabled: 'Desligado',
    },
    outcome: {
      watching: 'A vigiar alterações…',
      running: 'A executar…',
      finished: 'Concluído.',
      finishedIn: 'Concluído em {took}.',
      partial: {
        one: '{count} passo falhou. O resto do grafo executou-se na mesma.',
        other: '{count} passos falharam. O resto do grafo executou-se na mesma.',
      },
      failed: 'Nada foi concluído.',
      cancelled: 'Parado.',
    },
    watch: {
      runsSoFar: {
        one: '{count} execução até agora',
        other: '{count} execuções até agora',
      },
      pendingWaiting: '{count} em espera',
    },
    step: {
      neverRan: 'Nunca foi executado — {name} não terminou.',
    },
  },

  onboarding: {
    tour: {
      stepCount: 'Passo {current} de {total}',
      done: 'Concluído — continue quando estiver pronto.',
      waiting: 'À espera que o experimente.',
      finish: 'Terminar',
      next: 'Seguinte',
      canvas: {
        title: 'Esta é a sua tela',
        body: 'Um fluxo de trabalho é composto por alguns componentes ligados entre si. Tudo corre neste computador, e nada acede aos seus ficheiros até que o permita.',
      },
      addFirst: {
        title: 'Adicione o primeiro passo',
        body: 'À esquerda está cada componente instalado. Encontre Vigiar pasta e adicione-o — inicia o fluxo de trabalho sempre que aparece um ficheiro onde escolher.',
      },
      addSecond: {
        title: 'Adicione algo para fazer',
        body: 'Agora adicione Redimensionar imagem. Recebe uma imagem e faz uma cópia mais pequena, deixando a original intacta.',
      },
      connect: {
        title: 'Ligue-os entre si',
        body: 'Arraste da porta de ficheiro de Vigiar pasta até à porta de imagem de Redimensionar imagem. Um ficheiro ainda não é uma imagem, por isso o editor insere o passo que o abre — e recusa a ligação de imediato se os dois nunca pudessem encaixar.',
      },
      configure: {
        title: 'Diga-lhe qual a pasta',
        body: 'Seleccione um passo para o configurar à direita. Vigiar pasta precisa de saber qual a pasta a vigiar, e Guardar ficheiro precisa de saber onde colocar o resultado.',
      },
      allow: {
        title: 'Permita-lhe essa pasta',
        body: 'Um componente não consegue tocar em nada até que lho diga, e uma permissão está limitada à única pasta que escolher. Prima Permitir no passo que o pediu.',
      },
      run: {
        title: 'Execute-o',
        body: 'Prima Executar, ou Ctrl+Enter. Cada passo acende-se à medida que acontece, e o painel abaixo regista o que fez e quanto tempo demorou.',
      },
    },
    welcome: {
      title: 'Bem-vindo ao Encastra',
      lead: 'Crie software montando componentes. Escolha as peças, ligue-as e prima executar — neste computador, sem que nada aceda aos seus ficheiros até que o permita.',
      createFirst: {
        title: 'Crie o seu primeiro fluxo de trabalho',
        note: 'Um breve percurso guiado, cerca de um minuto',
      },
      exploreSample: {
        title: 'Explore um exemplo',
        note: '{name}, já construído — escolha as suas pastas',
      },
      skip: {
        title: 'Ignorar',
        note: 'Avance directamente. Isto está nas Definições, caso o queira mais tarde.',
      },
    },
  },

  // A única pergunta que esta aplicação faz antes de deitar trabalho fora.
  unsaved: {
    title: 'Alterações por guardar',
    reasons: {
      new: 'Tem alterações por guardar. Se começar um projeto novo, perde-as.',
      open: 'Tem alterações por guardar. Se abrir outro projeto, perde-as.',
      demo: 'Tem alterações por guardar. Se carregar um exemplo, perde-as.',
      restore: 'Tem alterações por guardar. Se restaurar uma versão anterior, perde-as.',
      close: 'Tem alterações por guardar. Se fechar o Encastra, perde-as.',
      'library-open': 'Tem alterações por guardar. Se abrir algo da sua biblioteca, perde-as.',
    },
    save: 'Guardar e continuar',
    discard: 'Descartar as alterações',
    cancel: 'Cancelar',
  },
  messages: {
    untitledProject: 'Sem título',
    recordingNote: 'Isto é uma gravação, não uma execução neste computador.',
    problemsToFix: {
      one: '{count} problema a resolver.',
      other: '{count} problemas a resolver.',
    },
    readyToRun: 'Este grafo está pronto a ser executado.',
    nothingRanProblems: {
      one: 'Nada foi executado: {count} problema a resolver primeiro.',
      other: 'Nada foi executado: {count} problemas a resolver primeiro.',
    },
    saved: {
      one: 'Guardado. {count} versão conservada.',
      other: 'Guardado. {count} versões conservadas.',
    },
    watchingChanges: 'A vigiar. Vai executar-se assim que algo aparecer.',
    running: 'Em execução.',
    stopping: 'A parar.',
    demoLoaded: '{name}: preencha {needs}, depois inicie-o.',
    restored: 'Restaurado. A versão de onde veio continua no histórico.',
    missingComponents: 'Este projecto precisa de {missing}, que não está instalado.',
    runtimeSilent: 'Algo no motor de execução não respondeu.',
    libraryMissing:
      '{name} não está onde estava. Volte a pô-lo lá, ou abra-o de onde estiver agora.',
    imported: '{name} recebido. Não se executou nada.',
    removedFromLibrary: '{name} já não está na lista. O ficheiro continua onde estava.',
    importInFlight: 'Está a ser escrita uma importação. A janela fecha assim que terminar.',
    removedAndDeleted: '{name} já não está na lista, e a cópia que o Encastra fez foi apagada.',
  },

  errors: {
    unknown:
      'O Encastra recusou isto por um motivo que esta versão não sabe nomear ({kind}). Nada foi alterado.',
    runtimeBusy: 'O motor está ocupado com outra coisa. Tenta outra vez daqui a pouco.',
    libraryBusy: 'A tua biblioteca está ocupada. Tenta outra vez daqui a pouco.',
    importInFlight: 'Está a ser escrita uma importação. A janela fecha-se quando tiver terminado.',
    chooserDidNotReturn: 'O seletor de pastas fechou sem responder. Não foi escolhido nada.',
    notAFolderOnThisMachine: 'O que o seletor devolveu não é uma pasta deste computador.',
    notAFileOnThisMachine: 'Isso não é um ficheiro nesta máquina.',
    fileUnusable: 'Esse ficheiro não pode ser usado: {reason}.',
    folderUnusable: 'Essa pasta não pode ser usada ({reason}).',
    notAProject: 'Isso não é um projeto do Encastra. O nome de um projeto termina em .encastra.',
    versionNotInProject:
      'Essa versão não está neste projeto. O histórico pode ter mudado desde a última vez que o viste.',
    versionsNotInProject:
      'Uma dessas duas versões não está neste projeto, por isso não há nada para comparar.',
    grantsRefused:
      'Não foi executado nada. {count} das permissões que concedeste não puderam ser dadas:',
    workingFolder:
      'O Encastra não conseguiu preparar uma pasta de trabalho para esta execução ({reason}). Não foi executado nada.',
    inputUnreadable: 'Não foi possível abrir {path} ({reason}). Não foi executado nada.',
    inputUnusable: 'O ficheiro de {node}.{port} não pode ser usado: {reason}. Nada foi executado.',
    inputNotChosen:
      'Escolhe o ficheiro de {node}.{port} com o botão Escolher antes de executar. Nada foi executado.',
    workflowAlreadyRunning: 'Já há um fluxo a correr. Pára-o antes de começar outro.',
    workflowInvalid: 'Este fluxo ainda não pode correr: há {problems} coisa(s) a corrigir antes.',
    workflowNotStarted: 'Não foi possível iniciar o fluxo ({reason}). Não foi executado nada.',
    destinationMissing: 'Essa pasta não existe. Escolhe uma que exista.',
    destinationIsALink:
      'Essa pasta é uma ligação para outro sítio, por isso o que fosse escrito iria parar a um lugar diferente do que escolheste. Escolhe a pasta em si.',
    destinationIsAFile:
      'Isso é um ficheiro, não uma pasta. Uma publicação precisa de uma pasta própria.',
    destinationNotChosen:
      'Escolhe primeiro a pasta de publicação com o botão Escolher, para que o Encastra escreva onde apontaste.',
    publicationPathEscapes:
      'Essa publicação não pode ser escrita onde foi pedido. Não foi escrito nada.',
    publicationAlreadyThere: '{folder} já contém uma publicação. Apaga-a ou escolhe outra pasta.',
    notOursToDelete:
      'Esse ficheiro é teu e fica onde está. O Encastra só apaga as cópias que ele próprio fez, ou seja, aquilo que importaste.',
    copyNotDeleted: 'Já não está na tua lista, mas a cópia não pôde ser apagada ({reason}).',
    noWindow: 'Não há nenhuma janela para fechar.',
    windowWouldNotClose: 'A janela não fechou. O teu trabalho continua aqui.',
    io: 'Algo neste computador recusou a operação ({reason}).',
    grant: {
      folderUnusable: '{node}: essa pasta não pode ser usada ({reason}).',
      folderNotChosen:
        '{node}: escolhe essa pasta com o botão Escolher antes de a permitir, para que o permitido seja aquilo que apontaste.',
      notDeclared: '{node}: este passo nunca pede {capability}, por isso não há nada a permitir.',
    },
    project: {
      generic: 'Não foi possível ler esse ficheiro de projeto.',
      unsupportedSchema:
        'Esta versão lê projetos na versão {ours}, e esse diz ser da versão {theirs}. Foi feito por um Encastra mais recente.',
      missingEntry: 'O ficheiro de projeto não contém {entry}, por isso não é um projeto completo.',
      invalid: '{entry}, dentro desse projeto, não é válido: {reason}.',
      archive:
        'O ficheiro de projeto não pôde ser lido como arquivo ({reason}). Pode estar danificado.',
      tooLarge:
        '{entry}, dentro desse projeto, expande-se para além do que esta versão lê ({limit} bytes).',
      tooLargeInTotal:
        'Esse projeto expande-se para além do que esta versão lê ({limit} bytes no total).',
      tooManySnapshots:
        'Esse projeto guarda {count} versões, e esta versão aceita no máximo {limit}.',
      fileTooLarge:
        'Esse ficheiro de projeto tem {size} bytes, e esta versão lê no máximo {limit}.',
      ambiguousArchive:
        'O arquivo do projeto lista {declared} entradas com apenas {distinct} nomes, ou seja, nomeia algo duas vezes. O Encastra não adivinha qual era.',
      io: 'O ficheiro de projeto não pôde ser lido nem escrito ({reason}).',
    },
    library: {
      generic: 'Não foi possível ler a tua biblioteca.',
      corrupt:
        'O índice da tua biblioteca não pôde ser lido ({reason}). Foi deixado exatamente como está: é o teu registo do teu próprio trabalho, e o Encastra não o recomeça.',
      writtenByAnotherVersion:
        'O índice da tua biblioteca foi escrito por outra versão do Encastra (diz ser da versão {theirs}, e esta lê a {ours}). Foi deixado como está.',
      tooManyEntries:
        'O índice da tua biblioteca lista {count} coisas, e esta versão aceita no máximo {max}. Foi deixado como está.',
      notOurs: 'Não foi o Encastra que pôs isso aí, por isso também não é o Encastra que o tira.',
      io: 'A tua biblioteca não pôde ser lida nem escrita ({reason}).',
    },
    bundle: {
      generic: 'Não foi possível preparar essa publicação.',
      reviewRefused:
        'A verificação encontrou {blocking} coisa(s) que teriam de mudar antes de isto poder ser publicado.',
      notAVersion: '«{version}» não é uma versão. As publicações são numeradas como 1.2.0.',
      notYourNamespace:
        '«{listing}» não está dentro do espaço de nomes de {publisher}. Uma publicação é arquivada sob o nome de quem a publica.',
      missing: 'Uma publicação precisa de: {field}.',
      tooLong:
        'O campo {field} é mais longo do que esta versão publica (no máximo {max} caracteres).',
      controlCharacters:
        'O campo {field} contém caracteres que podem esconder o que realmente diz. O Encastra recusa-o em vez de reescrever em silêncio o que escreveste.',
      tooLarge: 'Esse projeto tem cerca de {size}, e esta versão publica no máximo {max}.',
      notInstallable:
        'Esta versão não consegue instalar {publicationKind}, por isso não o oferece.',
      notAnIdentifier: '«{value}» não é um nome utilizável: {why}.',
    },
    import: {
      generic: 'Essa publicação não foi acolhida, e nada foi alterado neste computador.',
    },
  },

  demos: {
    imageProcessor: {
      name: 'Processador de imagens',
      summary:
        'Vigia uma pasta. Sempre que aparece uma imagem, faz uma cópia mais pequena noutra pasta.',
      needs: {
        watch: 'Uma pasta a vigiar',
        save: 'Uma pasta onde guardar',
      },
    },
    fileOrganiser: {
      name: 'Organizador de ficheiros',
      summary:
        'Vigia uma pasta e move o que lá chega para uma de outras três, consoante o tipo de ficheiro.',
      needs: {
        watch: 'Uma pasta a vigiar',
        images: 'Uma pasta para imagens',
        documents: 'Uma pasta para documentos',
      },
    },
    thumbnails: {
      name: 'Miniaturas',
      summary:
        'Transforma uma pasta de imagens em pré-visualizações quadradas, prontas para uma galeria ou uma grelha.',
      needs: {
        watch: 'Uma pasta a vigiar',
        save: 'Uma pasta onde guardar',
      },
    },
  },

  settings: {
    eyebrow: 'Definições',
    nav: {
      ariaLabel: 'Categorias de definições',
    },
    categories: {
      general: {
        label: 'Geral',
        description: 'Como começar, e o que esta aplicação lhe mostra ao abrir.',
      },
      appearance: {
        label: 'Aparência',
        description: 'Tema e movimento.',
      },
      language: {
        label: 'Idioma e região',
        description: 'O idioma que esta interface fala, e como mostra datas e números.',
      },
      workspace: {
        label: 'Espaço de trabalho',
        description: 'Onde vivem os seus projectos no disco.',
      },
      projects: {
        label: 'Projectos',
        description: 'Como um projecto abre, e o formato em que é guardado.',
      },
      editor: {
        label: 'Editor',
        description: 'Atalhos e comportamento enquanto constrói um grafo.',
      },
      canvas: {
        label: 'Tela',
        description:
          'Ajudas desenhadas na própria tela: a grelha, o alinhamento automático, o minimapa.',
      },
      runtime: {
        label: 'Motor de execução',
        description: 'O que aparece no ecrã enquanto um fluxo de trabalho é executado.',
      },
      components: {
        label: 'Componentes',
        description:
          'O que está instalado nesta versão, e exactamente o que cada um consegue alcançar.',
      },
      security: {
        label: 'Segurança',
        description:
          'O modelo de permissões, resumido. O detalhe completo vive no seu próprio ecrã.',
      },
      privacy: {
        label: 'Privacidade',
        description: 'O que esta aplicação recolhe e envia, apresentado como facto.',
      },
      notifications: {
        label: 'Notificações',
        description: 'Onde aparecem as notificações de um fluxo de trabalho, e onde não aparecem.',
      },
      files: {
        label: 'Ficheiros',
        description: 'O que o Encastra escreve no disco, e o que não escreve.',
      },
      updates: {
        label: 'Actualizações',
        description: 'Como uma versão mais recente chega a esta máquina.',
      },
      account: {
        label: 'Conta',
        description: 'Início de sessão, subscrições, e porque não há nenhuma.',
      },
      developer: {
        label: 'Programador',
        description:
          'Pormenores internos para quem os quiser, e uma forma de voltar aos valores predefinidos.',
      },
      diagnostics: {
        label: 'Diagnóstico',
        description:
          'O que esta versão e esta máquina reportam, pronto a colar num relatório de erro.',
      },
      about: {
        label: 'Acerca de',
        description: 'Versão, compilação, e onde vive a documentação completa.',
      },
    },

    shared: {
      startup: {
        label: 'Ao iniciar',
        hint: 'O que esta aplicação mostra quando abre.',
        options: {
          home: 'Início',
          lastProject: 'Último projecto',
        },
      },
      runtimeStatus: {
        label: 'Motor de execução',
        hint: 'Se um motor de execução Encastra real está associado a esta janela.',
        attached: 'Associado',
        notAttached: 'Não associado — pré-visualização no navegador',
      },
      signing: {
        label: 'Assinatura',
        hint: 'Se esta versão consegue provar quem a produziu.',
        status: 'Não assinada',
      },
      version: {
        label: 'Versão',
        hint: 'A versão que está a executar.',
        unknown: 'desconhecida',
      },
      openSecurity: 'Abrir Segurança',
      notBuilt: 'Ainda não construído',
      noneCollected: 'Nada recolhido',
      schemaValue: 'esquema {value}',
      projectFormatHint: 'Como é escrito um ficheiro .encastra guardado.',
    },

    general: {
      title: 'Como começar',
      welcomeTour: {
        label: 'Visita de boas-vindas',
        hint: 'O primeiro fluxo de trabalho guiado, mostrado uma vez na primeira utilização.',
        button: 'Mostrar as boas-vindas novamente',
      },
    },

    appearance: {
      title: 'Aparência',
      theme: {
        label: 'Tema',
        hint: 'Sistema segue o seu sistema operativo. Claro e escuro mantêm-se fixos independentemente disso.',
        options: {
          system: 'Sistema',
          light: 'Claro',
          dark: 'Escuro',
        },
      },
      motion: {
        label: 'Movimento',
        hint: 'Reduzido desliga as transições por completo em vez de as encurtar, independentemente do que o sistema preferir.',
        options: {
          system: 'Sistema',
          reduced: 'Reduzido',
        },
      },
    },

    language: {
      interface: {
        title: 'Idioma',
        picker: {
          label: 'Idioma da interface',
          hint: 'Traduz esta aplicação. O inglês é sempre a alternativa para o que ainda não estiver traduzido no idioma escolhido.',
        },
        loading: 'A carregar…',
        loadError: 'Não foi possível carregar {name}. Mantém-se o idioma actual.',
        comingLater: {
          label: 'Não traduzido',
          hint: 'A interface está preparada para os suportar; ainda ninguém os traduziu.',
        },
      },
      formatting: {
        title: 'Como este idioma escreve as coisas',
        dates: {
          label: 'Datas',
          hint: 'Hoje, pela ordem e palavras próprias deste idioma.',
        },
        times: {
          label: 'Horas',
          hint: 'A hora actual, segundo a convenção deste idioma.',
        },
        numbers: {
          label: 'Números',
          hint: 'Um número de exemplo, agrupado como este idioma o agrupa.',
        },
        note: 'Cada data, hora e número que esta aplicação mostra segue o idioma acima — não há um formato separado a escolher, tal como na maioria do software que faz isto bem.',
      },
    },

    workspace: {
      title: 'Arranque',
      lastProject: {
        label: 'Último projecto',
        hint: 'Registado automaticamente sempre que abre ou guarda um. É usado quando Ao iniciar está definido como Último projecto — um que entretanto tenha sido movido ou eliminado é simplesmente esquecido, em vez de mostrado como erro.',
        none: 'Nenhum ainda',
      },
    },

    projects: {
      location: {
        title: 'De onde abrem',
        label: 'Pasta de projectos predefinida',
        hint: 'Onde começa a caixa de diálogo de guardar. Se deixada vazia, abre onde o sistema esteve da última vez.',
        placeholder: 'Nenhuma pasta predefinida definida',
        browse: 'Procurar…',
        browseUnavailable:
          'Requer o motor de execução de ambiente de trabalho, não esta pré-visualização no navegador',
      },
      format: {
        title: 'Formato',
        label: 'Formato do ficheiro de projecto',
      },
      notBuilt: {
        title: 'Ainda não construído',
        copy: 'Não há uma lista de projectos recentes. As definições são por máquina, não por projecto — um projecto aberto noutra máquina não traz consigo as suas próprias preferências, apenas o grafo em si.',
      },
    },

    editor: {
      shortcuts: {
        title: 'Atalhos de teclado',
        table: {
          shortcut: 'Atalho',
          action: 'Acção',
        },
        actions: {
          runOrWatch: 'Executa o fluxo de trabalho, ou começa a vigiar se abrir com um gatilho',
          save: 'Guardar',
          saveAs: 'Guardar como',
          openProject: 'Abrir um projecto',
          undo: 'Desfazer',
          redo: 'Refazer',
          copySelection: 'Copiar a selecção',
          paste: 'Colar',
          duplicateSelection: 'Duplicar a selecção',
          selectAll: 'Seleccionar tudo',
          deleteSelection: 'Eliminar a selecção',
          connectFromStep: 'Começar uma ligação a partir do passo seleccionado, na tela',
          cycleConnections: 'Percorrer as ligações do passo seleccionado, na tela',
          deleteConnection: 'Eliminar a ligação seleccionada, na tela',
        },
        note: 'Fixos por agora, não reatribuíveis. Nenhum destes é activado enquanto escreve num campo de texto.',
      },
      notBuilt: {
        title: 'Ainda não construído',
        copy: 'A gravação automática, um intervalo de gravação configurável e personalizar os atalhos acima ainda não estão construídos.',
      },
    },

    canvas: {
      title: 'Tela',
      grid: {
        label: 'Grelha',
        hint: 'Mostra a grelha de alinhamento por trás dos nós na tela.',
      },
      snapToGrid: {
        label: 'Ajustar à grelha',
        hint: 'Os nós encaixam na grelha enquanto os arrasta, em vez de ficarem livres.',
      },
      minimap: {
        label: 'Minimapa',
        hint: 'Uma pequena visão geral de todo o grafo no canto da tela.',
      },
    },

    runtime: {
      runs: {
        title: 'Execuções',
        openRunPanel: {
          label: 'Abrir o painel de execução',
          hint: 'Traz o painel de execução automaticamente para a frente assim que uma execução começa.',
          toggleLabel: 'Abrir o painel de execução ao executar',
        },
      },
      notBuilt: {
        title: 'Ainda não construído',
        copy: 'Executar passos em paralelo, tempos limite de execução, limites de repetição e limites de recursos por execução não são configuráveis. Um fluxo de trabalho executa os seus passos pela ordem que a validação determinou, até à conclusão ou falha, com o tempo e a memória que a máquina lhe der.',
      },
    },

    components: {
      installed: {
        title: 'Instalados',
        components: {
          label: 'Componentes',
          hint: 'Tudo com que esta versão já vem equipada, em vez de descarregado.',
          builtIn: '{count} incluídos de origem',
        },
        thirdParty: {
          label: 'De terceiros',
          hint: 'Componentes externos a esta aplicação, executados numa sandbox sem autoridade ambiente.',
          installed: '{count} instalados',
          notBuilt: 'A sandbox ainda não foi construída',
        },
        permissionTable: {
          label: 'Tabela completa de permissões',
          hint: 'Cada componente instalado, a sua versão, e exactamente o que consegue alcançar.',
        },
      },
      table: {
        title: 'Cada componente, e o que consegue alcançar',
        headers: {
          component: 'Componente',
          version: 'Versão',
          source: 'Origem',
          canReach: 'Consegue alcançar',
        },
        kind: {
          core: 'incluído de origem',
          thirdParty: 'de terceiros',
        },
        none: 'nada',
        note: 'Nada fora desta lista está instalado, e nada aqui consegue alcançar algo que a sua própria linha não nomeie — sem acesso arbitrário a ficheiros, sem shell, sem rede além do que está listado.',
      },
      capabilityLabels: {
        fsRead: 'Ler ficheiros',
        fsWrite: 'Escrever ficheiros',
        netHttp: 'Usar a rede',
        systemNotify: 'Mostrar notificações',
        systemClipboard: 'Usar a área de transferência',
      },
      installMore: {
        title: 'Instalar mais',
        installFromFile: {
          label: 'Instalar a partir de um ficheiro',
          hint: 'Adicionar um componente de terceiros a esta versão.',
        },
        note: 'A sandbox onde estes componentes correriam está desenhada e documentada mas ainda não construída, pelo que nada além dos {count} listados acima pode ser instalado por agora.',
      },
    },

    security: {
      title: 'Modelo de permissões',
      copy: 'Um componente não consegue aceder aos seus ficheiros, à sua rede ou à sua área de transferência a menos que o seu manifesto o declare e você o permita — uma vez por execução. Cada pedido, permitido ou recusado, fica registado onde o pode consultar.',
      thirdParty: {
        label: 'Componentes de terceiros',
        hint: 'Se algo fora desta versão pode ser instalado e executado.',
        status: 'Ainda não é possível — a sandbox não está construída',
      },
      allowedInOpenWorkflow: {
        label: 'Permitido no fluxo de trabalho aberto',
        hint: 'Limpo assim que esta aplicação fecha.',
        nothingAllowed: 'Nada permitido',
        allowed: '{count} permitidos',
      },
      fullDetail: {
        label: 'Detalhe completo',
        hint: 'O que foi permitido, a quê, e contra o que isto não protege.',
      },
    },

    privacy: {
      collect: {
        title: 'O que esta aplicação poderia recolher, e não recolhe',
        telemetry: {
          label: 'Telemetria',
          hint: 'Dados de utilização — que funcionalidades são usadas, com que frequência — enviados para um servidor para que uma equipa pudesse priorizar o seu trabalho.',
        },
        crashReports: {
          label: 'Relatórios de falha',
          hint: 'Um stack trace e uma versão de compilação, enviados automaticamente quando algo falha, para que pudesse ser corrigido sem que tivesse de o reportar.',
        },
        analytics: {
          label: 'Análise de utilização',
          hint: 'Contagens de funcionalidades, duração de sessão, ou qualquer outra coisa que transformasse a forma como usa esta aplicação num número no painel de outra pessoa.',
        },
        note: 'As três precisariam de um servidor para onde enviar. Não há nenhum — um interruptor de "desligado" aqui implicaria um mecanismo que não existe.',
      },
      account: {
        title: 'Conta',
        signIn: {
          label: 'Início de sessão',
          hint: 'Uma identidade associada a esta aplicação, tal como a maioria do software com servidor pede uma.',
          status: 'Nenhum — não há servidor onde iniciar sessão',
        },
      },
      yourData: {
        title: 'Os seus dados',
        projects: {
          label: 'Projectos',
          hint: 'Guardados como ficheiros .encastra onde os guardar. Sem uma segunda cópia oculta.',
          status: 'Ficam nesta máquina',
        },
        runJournals: {
          label: 'Registos de execução',
          hint: 'Registam tamanhos e formas, nunca o conteúdo dos ficheiros. Mantidos em memória enquanto a janela está aberta.',
          status: 'Descartados ao fechar',
        },
      },
    },

    notifications: {
      window: {
        title: 'Nesta janela',
        toast: {
          label: 'Notificações',
          hint: 'Um fluxo de trabalho pode pedir para mostrar uma, usando a mesma capacidade system.notify que qualquer outra permissão — declarada no seu manifesto e permitida antes de algo aparecer.',
          shown: '{count} mostradas nesta sessão',
        },
        note: 'São mantidas até às 20 mais recentes enquanto a janela está aberta; dispensá-las limpa a lista. Fechar a aplicação esquece-as, tal como tudo o resto que não seja um projecto guardado.',
      },
      notBuilt: {
        title: 'Ainda não construído',
        copy: 'Não há permissão de notificação do sistema operativo, nem e-mail, nem notificações push — nada o alcança fora desta janela. Também não está construído um histórico de notificações anteriores à sessão actual.',
      },
    },

    files: {
      disk: {
        title: 'O que vive no disco',
        projects: {
          term: 'Projectos',
          detail:
            'ficheiros, onde escolher guardá-los — consulte Projectos para a pasta predefinida.',
        },
        preferences: {
          term: 'Preferências',
          detail:
            'Armazenamento do navegador na origem própria desta aplicação, não um ficheiro que possa abrir directamente.',
        },
        componentData: {
          term: 'Dados de componentes',
          detail:
            'Nenhuns. Cada componente nesta versão está compilado; nada é descarregado ou colocado em cache.',
        },
        logs: {
          term: 'Registos',
          detail:
            'Nenhuns escritos no disco. Um registo de execução é mantido em memória enquanto a janela está aberta e descartado quando fecha.',
        },
      },
      notBuilt: {
        title: 'Ainda não construído',
        copy: 'Não há importação ou exportação de definições, nem forma de mover preferências entre máquinas a não ser defini-las novamente lá. Um projecto em si já é portátil — é um único ficheiro — mas as preferências deste ecrã não são.',
      },
    },

    updates: {
      thisBuild: {
        title: 'Esta versão',
        channel: {
          label: 'Como uma mais recente chega a esta máquina',
          hint: 'O que acontece quando uma nova versão é lançada.',
          fact: 'Sem canal de actualizações. Actualizar significa descarregar um instalador novo e instalá-lo sobre este.',
        },
      },
      verify: {
        title: 'Verificar o que instala',
        copy: 'As versões não são assinadas digitalmente, pelo que o Windows avisará sobre um editor não reconhecido — um aviso correcto, já que nada aqui prova quem produziu o ficheiro. Cada versão publica antes um hash SHA-256, para verificar um instalador antes de o executar.',
      },
      notBuilt: {
        title: 'Ainda não construído',
        copy: 'A verificação automática de actualizações, os canais de actualização como mecanismo funcional, e as transferências em segundo plano não estão construídos. Hoje, verificar se há uma versão nova significa fazê-lo manualmente.',
      },
    },

    account: {
      title: 'Sem contas',
      copy: 'Não há início de sessão, nem conta, nem servidor com quem falar. Nada aqui tem uma subscrição, um plano, uma sessão, ou uma lista de dispositivos a gerir — cada projecto e cada preferência deste ecrã vive nesta máquina, e só nesta máquina.',
    },

    developer: {
      internals: {
        title: 'Pormenores internos',
        developerMode: {
          label: 'Modo de programador',
          hint: 'Mostra os valores em bruto das preferências e um resumo compacto de cada componente carregado, abaixo.',
        },
      },
      currentPreferences: {
        title: 'Preferências actuais',
      },
      loadedComponents: {
        title: 'Componentes carregados',
      },
      hidden: {
        title: 'Ocultado por agora',
        copy: 'Active o modo de programador acima para ver os valores em bruto das preferências e um resumo de cada componente carregado.',
      },
      reset: {
        title: 'Repor',
        restoreDefaults: {
          label: 'Repor valores predefinidos',
          hint: 'Devolve cada definição deste ecrã ao estado da primeira utilização. Não afecta os seus projectos, permissões concedidas ou componentes instalados.',
          button: 'Repor todas as definições',
        },
      },
    },

    diagnostics: {
      rows: {
        version: 'Versão do Encastra',
        runtime: 'Runtime',
        protocolSchema: 'Esquema do protocolo de componentes',
        projectSchema: 'Esquema do formato de projecto',
        components: 'Componentes instalados',
        platform: 'Plataforma',
        architecture: 'Arquitectura',
        gpu: 'GPU',
        userAgent: 'Agente de utilizador do WebView',
        gpuUnknown: 'Não é possível determinar',
        platformUnknown: 'Desconhecida',
        architectureUnknown: 'Não indicada pelo WebView',
      },
      machine: {
        title: 'Esta máquina e esta versão',
      },
      share: {
        title: 'Partilhar',
        copy: {
          label: 'Copiar',
          hint: 'Copia para a área de transferência todas as linhas acima.',
          button: 'Copiar',
          copied: 'Copiado',
          failed: 'Não foi possível copiar',
        },
        export: {
          label: 'Exportar',
          hint: 'Guarda o mesmo relatório como ficheiro de texto.',
          button: 'Exportar…',
        },
        note: 'Nada aqui inclui um caminho de projecto, um valor de preferência, ou um token — foi pensado para poder ser colado em qualquer lugar público sem problema. O relatório é copiado e exportado em inglês, para que qualquer pessoa do projecto o possa ler.',
      },
    },

    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Crie software a partir de peças que realmente encaixam.',
      },
      thisBuild: {
        title: 'Esta versão',
        componentProtocol: {
          label: 'Protocolo de componentes',
          hint: 'O que o manifesto de um componente tem de cumprir para carregar.',
        },
        projectFormat: {
          label: 'Formato do projecto',
        },
        updates: {
          label: 'Actualizações',
          hint: 'Como uma versão mais recente chega a esta máquina.',
          fact: 'Sem canal de actualizações. Actualizar significa descarregar um novo instalador.',
        },
      },
      readMore: {
        title: 'Saber mais',
        readme: 'o que é o Encastra',
        security: 'o modelo de permissões, na íntegra',
        release: 'como uma versão é produzida e verificada',
        roadmap: 'o que está construído, e o que ainda não está',
      },
    },
  },
};

export default pt;
