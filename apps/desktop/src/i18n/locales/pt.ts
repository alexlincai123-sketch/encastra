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
        description: 'Aparência, movimento e a visita guiada da primeira utilização.',
      },
      workspace: {
        label: 'Espaço de trabalho',
        description: 'Onde vivem os projectos, e com que esta aplicação abre.',
      },
      editor: {
        label: 'Editor',
        description: 'Ajudas mostradas na tela enquanto constrói um grafo.',
      },
      runtime: {
        label: 'Motor de execução',
        description: 'O que aparece no ecrã enquanto um fluxo de trabalho é executado.',
      },
      components: {
        label: 'Componentes',
        description: 'O que está instalado nesta versão, e o que cada um consegue alcançar.',
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
      advanced: {
        label: 'Avançado',
        description:
          'Pormenores internos para quem os quiser, e uma forma de voltar aos valores predefinidos.',
      },
      about: {
        label: 'Acerca de',
        description: 'Versão, compilação, e onde vive a documentação completa.',
      },
    },
    general: {
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
      getStarted: {
        title: 'Primeiros passos',
        welcomeTour: {
          label: 'Visita de boas-vindas',
          hint: 'O primeiro fluxo de trabalho guiado, mostrado uma vez na primeira utilização.',
          button: 'Mostrar as boas-vindas novamente',
        },
      },
    },
    workspace: {
      projects: {
        title: 'Projectos',
        folder: {
          label: 'Pasta de projectos predefinida',
          hint: 'Onde começa a caixa de diálogo de guardar. Se deixada vazia, abre onde o sistema esteve da última vez.',
          placeholder: 'Nenhuma pasta predefinida definida',
          browseTitleUnavailable:
            'Requer o motor de execução de ambiente de trabalho, não esta pré-visualização no navegador',
        },
        startup: {
          label: 'Ao iniciar',
          hint: 'O que esta aplicação mostra quando abre.',
          options: {
            home: 'Início',
            lastProject: 'Último projecto',
          },
        },
      },
    },
    editor: {
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
    },
    runtime: {
      runs: {
        title: 'Execuções',
        openRunPanel: {
          label: 'Abrir o painel de execução',
          hint: 'Traz o painel de execução automaticamente para a frente assim que uma execução começa.',
        },
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
          button: 'Abrir Segurança',
        },
      },
      installMore: {
        title: 'Instalar mais',
        installFromFile: {
          label: 'Instalar a partir de um ficheiro',
          hint: 'Adicionar um componente de terceiros a esta versão.',
          status: 'Ainda não construída',
        },
        note: 'A sandbox onde estes componentes correriam está desenhada e documentada mas ainda não construída, pelo que nada além dos {count} listados acima pode ser instalado por agora.',
      },
    },
    security: {
      permissionModel: {
        title: 'Modelo de permissões',
        copy: 'Um componente não consegue aceder aos seus ficheiros, à sua rede ou à sua área de transferência a menos que o seu manifesto o declare e você o permita — uma vez por execução. Cada pedido, permitido ou recusado, fica registado onde o pode consultar.',
        allowedInOpenWorkflow: {
          label: 'Permitido no fluxo de trabalho aberto',
          hint: 'Limpo assim que esta aplicação fecha.',
          nothingAllowed: 'Nada permitido',
          allowed: '{count} permitidos',
        },
        fullDetail: {
          label: 'Detalhe completo',
          hint: 'O que foi permitido, a quê, e contra o que isto não protege.',
          button: 'Abrir Segurança',
        },
      },
    },
    privacy: {
      collection: {
        title: 'Recolha',
        telemetry: {
          label: 'Telemetria',
          hint: 'Dados de utilização enviados para um servidor.',
          status: 'Nenhuma recolhida',
        },
        crashReports: {
          label: 'Relatórios de falha',
          hint: 'Relatórios automáticos enviados para algum lado quando algo falha.',
          status: 'Nenhum',
        },
        analytics: {
          label: 'Análise',
          hint: 'Padrões de utilização, contagens de funcionalidades ou algo semelhante.',
          status: 'Nenhuma',
        },
        account: {
          label: 'Conta',
          hint: 'Uma sessão ou subscrição associada a esta aplicação.',
          status: 'Nenhuma — não há servidor',
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
    advanced: {
      internals: {
        title: 'Pormenores internos',
        developerMode: {
          label: 'Modo de programador',
          hint: 'Mostra identificadores de componentes, digests e o registo de execução em bruto para quem os quiser.',
        },
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
    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Crie software a partir de peças que realmente encaixam.',
      },
      thisBuild: {
        title: 'Esta versão',
        version: {
          label: 'Versão',
          hint: 'A versão que está a executar.',
          unknown: 'desconhecida',
        },
        runtime: {
          label: 'Motor de execução',
          hint: 'Se um motor de execução Encastra real está associado a esta janela.',
          attached: 'Associado',
          notAttached: 'Não associado — pré-visualização no navegador',
        },
        componentProtocol: {
          label: 'Protocolo de componentes',
          hint: 'O que o manifesto de um componente tem de cumprir para carregar.',
        },
        projectFormat: {
          label: 'Formato do projecto',
          hint: 'Como é escrito um ficheiro .encastra guardado.',
        },
        signing: {
          label: 'Assinatura',
          hint: 'Se esta versão consegue provar quem a produziu.',
          status: 'Não assinada',
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
