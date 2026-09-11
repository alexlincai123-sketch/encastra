/**
 * Español. Toda clave aquí debe existir también en inglés — lo comprueba `i18n.test.ts`. Una
 * clave que falta aquí simplemente recurre al inglés; una traducción dudosa no se incluye.
 */

import type { Messages } from '../index';

const es: Messages = {
  common: {
    close: 'Cerrar',
    dismiss: 'Descartar',
  },

  sidebar: {
    ariaLabel: 'Secciones',
    running: ', en ejecución',
    items: {
      home: 'Inicio',
      builder: 'Constructor',
      components: 'Componentes',
      security: 'Seguridad',
      settings: 'Ajustes',
    },
  },

  home: {
    intro: {
      heading: 'Crea software a partir de piezas que encajan.',
      body: 'Coloca componentes en un lienzo, conéctalos y pulsa iniciar. Todo se ejecuta en este equipo, y nada accede a tus archivos sin que se te pregunte antes.',
    },
    actions: {
      new: {
        title: 'Nuevo flujo de trabajo',
        detail: 'Empieza desde un lienzo vacío',
      },
      open: {
        title: 'Abrir',
        detailReady: 'Un archivo .encastra que guardaste antes',
        detailUnavailable: 'Requiere la aplicación de escritorio',
      },
      browse: {
        title: 'Explorar componentes',
        detail: {
          one: '{count} instalado, y qué puede hacer',
          other: '{count} instalados, y qué puede hacer cada uno',
        },
      },
    },
    continue: {
      heading: 'Donde lo dejaste',
      steps: {
        one: '{count} paso',
        other: '{count} pasos',
      },
      unsaved: ' · sin guardar todavía',
    },
    samples: {
      heading: 'Ejemplos',
      note: 'Flujos de trabajo reales sobre el motor real. Cada uno necesita que elijas sus carpetas antes de poder iniciarse — un ejemplo que escribiera en un sitio que no habías elegido sería justo lo contrario de la idea.',
      needs: 'Necesita: {list}',
    },
  },

  palette: {
    title: 'Componentes',
    empty: 'No hay componentes instalados.',
    asksTo: 'Pide permiso para: {list}',
    capabilities: {
      fsRead: 'leer archivos',
      fsWrite: 'escribir archivos',
      netHttp: 'usar la red',
      systemNotify: 'mostrar notificaciones',
      systemClipboard: 'usar el portapapeles',
    },
  },

  canvas: {
    ariaLabel: 'Lienzo del flujo de trabajo',
    refusal: {
      selfCycle: {
        headline: 'Un paso no puede alimentarse a sí mismo.',
        detail:
          'Un flujo de trabajo se ejecuta hacia delante. Para repetir el mismo trabajo varias veces, inícialo desde un disparador — Vigilar carpeta o Temporizador — que lo ejecuta una vez por cada evento.',
      },
      bridge: 'Un paso que produjera {bridge} entre medias los uniría.',
    },
    empty: {
      heading: 'Tu lienzo está vacío',
      body: 'Un flujo de trabajo es unos pocos componentes unidos entre sí. Elige uno de la izquierda para colocar tu primer paso, conecta su salida con el siguiente y pulsa Ejecutar.',
      hint: 'Cada componente indica qué puede alcanzar antes de ejecutarse, y nada toca tus archivos hasta que lo permitas.',
    },
    keysHint:
      'Usa las flechas para moverte entre pasos, Intro para abrir un paso en el inspector, Escape para deseleccionar y Suprimir para eliminar el paso seleccionado.',
    a11y: {
      selected: '{name}, paso {index} de {total}, seleccionado.',
    },
  },

  settings: {
    eyebrow: 'Ajustes',
    nav: {
      ariaLabel: 'Categorías de ajustes',
    },
    categories: {
      general: {
        label: 'General',
        description: 'Apariencia, movimiento y el recorrido de primer uso.',
      },
      workspace: {
        label: 'Espacio de trabajo',
        description: 'Dónde viven los proyectos y con qué se abre esta aplicación.',
      },
      editor: {
        label: 'Editor',
        description: 'Ayudas que se muestran en el lienzo mientras construyes un grafo.',
      },
      runtime: {
        label: 'Motor de ejecución',
        description: 'Qué ocurre en pantalla mientras se ejecuta un flujo de trabajo.',
      },
      components: {
        label: 'Componentes',
        description: 'Qué está instalado en esta versión y qué puede alcanzar cada uno.',
      },
      security: {
        label: 'Seguridad',
        description:
          'El modelo de permisos, resumido. El detalle completo vive en su propia pantalla.',
      },
      privacy: {
        label: 'Privacidad',
        description: 'Qué recopila y envía esta aplicación, expuesto como hecho.',
      },
      advanced: {
        label: 'Avanzado',
        description:
          'Detalles internos para quien los quiera, y una forma de volver a los valores por defecto.',
      },
      about: {
        label: 'Acerca de',
        description: 'Versión, compilación y dónde vive la documentación completa.',
      },
    },
    general: {
      appearance: {
        title: 'Apariencia',
        theme: {
          label: 'Tema',
          hint: 'Sistema sigue tu sistema operativo. Claro y oscuro se mantienen fijos independientemente de él.',
          options: {
            system: 'Sistema',
            light: 'Claro',
            dark: 'Oscuro',
          },
        },
        motion: {
          label: 'Movimiento',
          hint: 'Reducido desactiva las transiciones por completo en lugar de acortarlas, sin importar lo que prefiera tu sistema.',
          options: {
            system: 'Sistema',
            reduced: 'Reducido',
          },
        },
      },
      getStarted: {
        title: 'Primeros pasos',
        welcomeTour: {
          label: 'Recorrido de bienvenida',
          hint: 'El primer flujo de trabajo guiado, mostrado una vez en el primer uso.',
          button: 'Mostrar la bienvenida de nuevo',
        },
      },
    },
    workspace: {
      projects: {
        title: 'Proyectos',
        folder: {
          label: 'Carpeta de proyectos por defecto',
          hint: 'Dónde empieza el diálogo de guardado. Si se deja vacío, se abre donde el sistema estuvo la última vez.',
          placeholder: 'Sin carpeta por defecto',
          browseTitleUnavailable:
            'Requiere el motor de escritorio, no esta vista previa en el navegador',
        },
        startup: {
          label: 'Al iniciar',
          hint: 'Qué muestra esta aplicación al abrirse.',
          options: {
            home: 'Inicio',
            lastProject: 'Último proyecto',
          },
        },
      },
    },
    editor: {
      canvas: {
        title: 'Lienzo',
        grid: {
          label: 'Cuadrícula',
          hint: 'Muestra la cuadrícula de alineación detrás de los nodos en el lienzo.',
        },
        snapToGrid: {
          label: 'Ajustar a la cuadrícula',
          hint: 'Los nodos se ajustan a la cuadrícula mientras los arrastras, en vez de quedar libres.',
        },
        minimap: {
          label: 'Minimapa',
          hint: 'Una pequeña vista general de todo el grafo en la esquina del lienzo.',
        },
      },
    },
    runtime: {
      runs: {
        title: 'Ejecuciones',
        openRunPanel: {
          label: 'Abrir el panel de ejecución',
          hint: 'Trae al frente el panel de ejecución automáticamente en cuanto empieza una ejecución.',
        },
      },
    },
    components: {
      installed: {
        title: 'Instalados',
        components: {
          label: 'Componentes',
          hint: 'Todo lo que incluye esta versión de fábrica, en vez de descargado.',
          builtIn: '{count} incluidos de fábrica',
        },
        thirdParty: {
          label: 'De terceros',
          hint: 'Componentes externos a esta aplicación, ejecutados en un entorno aislado sin autoridad ambiental.',
          installed: '{count} instalados',
          notBuilt: 'El entorno aislado aún no está construido',
        },
        permissionTable: {
          label: 'Tabla completa de permisos',
          hint: 'Cada componente instalado, su versión, y exactamente qué puede alcanzar.',
          button: 'Abrir Seguridad',
        },
      },
      installMore: {
        title: 'Instalar más',
        installFromFile: {
          label: 'Instalar desde un archivo',
          hint: 'Añade un componente de terceros a esta versión.',
          status: 'Aún no está construido',
        },
        note: 'El entorno aislado donde estos componentes se ejecutarían está diseñado y documentado pero aún no construido, así que nada fuera de los {count} listados arriba puede instalarse todavía.',
      },
    },
    security: {
      permissionModel: {
        title: 'Modelo de permisos',
        copy: 'Un componente no puede acceder a tus archivos, tu red ni tu portapapeles a menos que su manifiesto lo declare y tú lo permitas — una vez por ejecución. Toda solicitud, permitida o rechazada, queda registrada donde puedes leerla.',
        allowedInOpenWorkflow: {
          label: 'Permitido en el flujo de trabajo abierto',
          hint: 'Se borra en cuanto se cierra esta aplicación.',
          nothingAllowed: 'Nada permitido',
          allowed: '{count} permitidos',
        },
        fullDetail: {
          label: 'Detalle completo',
          hint: 'Qué se permitió, a qué, y qué no protege esto.',
          button: 'Abrir Seguridad',
        },
      },
    },
    privacy: {
      collection: {
        title: 'Recopilación',
        telemetry: {
          label: 'Telemetría',
          hint: 'Datos de uso enviados a un servidor.',
          status: 'Ninguno recopilado',
        },
        crashReports: {
          label: 'Informes de fallos',
          hint: 'Informes automáticos enviados a algún sitio cuando algo falla.',
          status: 'Ninguno',
        },
        analytics: {
          label: 'Analítica',
          hint: 'Patrones de uso, recuentos de funciones o algo similar.',
          status: 'Ninguna',
        },
        account: {
          label: 'Cuenta',
          hint: 'Un inicio de sesión o suscripción asociado a esta aplicación.',
          status: 'Ninguna — no hay servidor',
        },
      },
      yourData: {
        title: 'Tus datos',
        projects: {
          label: 'Proyectos',
          hint: 'Guardados como archivos .encastra donde tú decidas. Sin una segunda copia oculta.',
          status: 'Se quedan en este equipo',
        },
        runJournals: {
          label: 'Registros de ejecución',
          hint: 'Registran tamaños y formas, nunca el contenido de los archivos. Se guardan en memoria mientras la ventana está abierta.',
          status: 'Se descartan al cerrar',
        },
      },
    },
    advanced: {
      internals: {
        title: 'Detalles internos',
        developerMode: {
          label: 'Modo desarrollador',
          hint: 'Muestra identificadores de componentes, resúmenes y el registro de ejecución en bruto para quien los quiera.',
        },
      },
      reset: {
        title: 'Restablecer',
        restoreDefaults: {
          label: 'Restaurar valores por defecto',
          hint: 'Devuelve cada ajuste de esta pantalla a como estaba en el primer uso. No toca tus proyectos, permisos concedidos ni componentes instalados.',
          button: 'Restablecer todos los ajustes',
        },
      },
    },
    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Crea software a partir de piezas que realmente encajan.',
      },
      thisBuild: {
        title: 'Esta versión',
        version: {
          label: 'Versión',
          hint: 'La versión que estás ejecutando.',
          unknown: 'desconocida',
        },
        runtime: {
          label: 'Motor de ejecución',
          hint: 'Si hay un motor real de Encastra conectado a esta ventana.',
          attached: 'Conectado',
          notAttached: 'No conectado — vista previa en el navegador',
        },
        componentProtocol: {
          label: 'Protocolo de componentes',
          hint: 'Qué debe cumplir el manifiesto de un componente para poder cargarse.',
        },
        projectFormat: {
          label: 'Formato de proyecto',
          hint: 'Cómo se escribe un archivo .encastra guardado.',
        },
        signing: {
          label: 'Firma',
          hint: 'Si esta versión puede demostrar quién la produjo.',
          status: 'Sin firmar',
        },
        updates: {
          label: 'Actualizaciones',
          hint: 'Cómo llega una versión más reciente a este equipo.',
          fact: 'No hay canal de actualizaciones. Actualizar significa descargar un nuevo instalador.',
        },
      },
      readMore: {
        title: 'Leer más',
        readme: 'qué es Encastra',
        security: 'el modelo de permisos, completo',
        release: 'cómo se produce y verifica una versión',
        roadmap: 'qué está construido y qué todavía no',
      },
    },
  },
};

export default es;
