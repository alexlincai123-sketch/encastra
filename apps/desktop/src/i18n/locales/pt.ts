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
  },

  sidebar: {
    ariaLabel: 'Secções',
    running: ', em execução',
    items: {
      home: 'Início',
      builder: 'Construtor',
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
    },
    empty: {
      heading: 'A sua tela está vazia',
      body: 'Um fluxo de trabalho é composto por alguns componentes ligados entre si. Escolha um à esquerda para colocar o seu primeiro passo, ligue a sua saída ao seguinte e prima Executar.',
      hint: 'Cada componente indica o que consegue alcançar antes de ser executado, e nada toca nos seus ficheiros até que o permita.',
    },
    keysHint:
      'Use as setas para se mover entre passos, Enter para abrir um passo no inspector, Escape para desmarcar e Delete para remover o passo seleccionado.',
    a11y: {
      selected: '{name}, passo {index} de {total}, seleccionado.',
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
          label: 'Mais tarde',
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
