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
        description: 'Primeros pasos, y qué te muestra esta aplicación al abrirse.',
      },
      appearance: {
        label: 'Apariencia',
        description: 'Tema y movimiento.',
      },
      language: {
        label: 'Idioma y región',
        description: 'El idioma que habla esta interfaz, y cómo muestra fechas y números.',
      },
      workspace: {
        label: 'Espacio de trabajo',
        description: 'Dónde viven tus proyectos en el disco.',
      },
      projects: {
        label: 'Proyectos',
        description: 'Cómo se abre un proyecto, y el formato en que se guarda.',
      },
      editor: {
        label: 'Editor',
        description: 'Atajos y comportamiento mientras construyes un grafo.',
      },
      canvas: {
        label: 'Lienzo',
        description: 'Ayudas dibujadas en el propio lienzo: la cuadrícula, el ajuste, el minimapa.',
      },
      runtime: {
        label: 'Motor de ejecución',
        description: 'Qué ocurre en pantalla mientras se ejecuta un flujo de trabajo.',
      },
      components: {
        label: 'Componentes',
        description:
          'Qué está instalado en esta versión, y exactamente qué puede alcanzar cada uno.',
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
      notifications: {
        label: 'Notificaciones',
        description: 'Dónde aparecen las notificaciones de un flujo de trabajo, y dónde no.',
      },
      files: {
        label: 'Archivos',
        description: 'Qué escribe Encastra en el disco, y qué no.',
      },
      updates: {
        label: 'Actualizaciones',
        description: 'Cómo llega una versión más reciente a este equipo.',
      },
      account: {
        label: 'Cuenta',
        description: 'Inicio de sesión, suscripciones, y por qué no hay ninguna.',
      },
      developer: {
        label: 'Desarrollador',
        description:
          'Detalles internos para quien los quiera, y una forma de volver a los valores por defecto.',
      },
      diagnostics: {
        label: 'Diagnóstico',
        description:
          'Qué informan esta versión y este equipo, listo para pegar en un reporte de error.',
      },
      about: {
        label: 'Acerca de',
        description: 'Versión, compilación y dónde vive la documentación completa.',
      },
    },

    shared: {
      startup: {
        label: 'Al iniciar',
        hint: 'Qué muestra esta aplicación al abrirse.',
        options: {
          home: 'Inicio',
          lastProject: 'Último proyecto',
        },
      },
      runtimeStatus: {
        label: 'Motor de ejecución',
        hint: 'Si hay un motor real de Encastra conectado a esta ventana.',
        attached: 'Conectado',
        notAttached: 'No conectado — vista previa en el navegador',
      },
      signing: {
        label: 'Firma',
        hint: 'Si esta versión puede demostrar quién la produjo.',
        status: 'Sin firmar',
      },
      version: {
        label: 'Versión',
        hint: 'La versión que estás ejecutando.',
        unknown: 'desconocida',
      },
      openSecurity: 'Abrir Seguridad',
      notBuilt: 'Aún no está construido',
      noneCollected: 'Nada recopilado',
      schemaValue: 'esquema {value}',
      projectFormatHint: 'Cómo se escribe un archivo .encastra guardado.',
    },

    general: {
      title: 'Primeros pasos',
      welcomeTour: {
        label: 'Recorrido de bienvenida',
        hint: 'El primer flujo de trabajo guiado, mostrado una vez en el primer uso.',
        button: 'Mostrar la bienvenida de nuevo',
      },
    },

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

    language: {
      interface: {
        title: 'Idioma',
        picker: {
          label: 'Idioma de la interfaz',
          hint: 'Traduce esta aplicación. El inglés es siempre el respaldo para lo que todavía no esté traducido en el idioma que elijas.',
        },
        loading: 'Cargando…',
        loadError: 'No se pudo cargar {name}. Se mantiene el idioma actual.',
        comingLater: {
          label: 'Próximamente',
          hint: 'La interfaz está preparada para admitirlos; todavía nadie los ha traducido.',
        },
      },
      formatting: {
        title: 'Cómo escribe las cosas este idioma',
        dates: {
          label: 'Fechas',
          hint: 'Hoy, con el orden y las palabras propios de este idioma.',
        },
        times: {
          label: 'Horas',
          hint: 'La hora actual, según la convención de este idioma.',
        },
        numbers: {
          label: 'Números',
          hint: 'Un número de ejemplo, agrupado como lo agrupa este idioma.',
        },
        note: 'Cada fecha, hora y número que muestra esta aplicación sigue el idioma de arriba — no hay un formato aparte que elegir, igual que en la mayoría del software que lo hace bien.',
      },
    },

    workspace: {
      title: 'Arranque',
      lastProject: {
        label: 'Último proyecto',
        hint: 'Se registra automáticamente cada vez que abres o guardas un proyecto. Se usa cuando Al iniciar está configurado en Último proyecto — uno que se haya movido o eliminado desde entonces se olvida en silencio, en vez de mostrarse como error.',
        none: 'Ninguno todavía',
      },
    },

    projects: {
      location: {
        title: 'Desde dónde se abren',
        label: 'Carpeta de proyectos por defecto',
        hint: 'Dónde empieza el diálogo de guardado. Si se deja vacío, se abre donde el sistema estuvo la última vez.',
        placeholder: 'Sin carpeta por defecto',
        browse: 'Examinar…',
        browseUnavailable: 'Requiere el motor de escritorio, no esta vista previa en el navegador',
      },
      format: {
        title: 'Formato',
        label: 'Formato del archivo de proyecto',
      },
      notBuilt: {
        title: 'Aún no está construido',
        copy: 'No hay una lista de proyectos recientes. Los ajustes son por equipo, no por proyecto — un proyecto abierto en otro equipo no lleva consigo sus propias preferencias, solo el grafo en sí.',
      },
    },

    editor: {
      shortcuts: {
        title: 'Atajos de teclado',
        table: {
          shortcut: 'Atajo',
          action: 'Acción',
        },
        actions: {
          runOrWatch:
            'Ejecuta el flujo de trabajo, o empieza a vigilar si se abre con un disparador',
          save: 'Guardar',
          saveAs: 'Guardar como',
          openProject: 'Abrir un proyecto',
          undo: 'Deshacer',
          redo: 'Rehacer',
          copySelection: 'Copiar la selección',
          paste: 'Pegar',
          duplicateSelection: 'Duplicar la selección',
          selectAll: 'Seleccionar todo',
          deleteSelection: 'Eliminar la selección',
        },
        note: 'Fijos por ahora, no reasignables. Ninguno se activa mientras escribes en un campo de texto.',
      },
      notBuilt: {
        title: 'Aún no está construido',
        copy: 'El guardado automático, un intervalo de guardado configurable y personalizar los atajos de arriba todavía no están construidos.',
      },
    },

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

    runtime: {
      runs: {
        title: 'Ejecuciones',
        openRunPanel: {
          label: 'Abrir el panel de ejecución',
          hint: 'Trae al frente el panel de ejecución automáticamente en cuanto empieza una ejecución.',
          toggleLabel: 'Abrir el panel de ejecución al ejecutar',
        },
      },
      notBuilt: {
        title: 'Aún no está construido',
        copy: 'Ejecutar pasos en paralelo, tiempos de espera de ejecución, límites de reintento y límites de recursos por ejecución no son configurables. Un flujo de trabajo ejecuta sus pasos en el orden que decidió la validación, hasta completarse o fallar, con el tiempo y la memoria que le dé el equipo.',
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
        },
      },
      table: {
        title: 'Cada componente, y qué puede alcanzar',
        headers: {
          component: 'Componente',
          version: 'Versión',
          source: 'Origen',
          canReach: 'Puede alcanzar',
        },
        kind: {
          core: 'incluido de fábrica',
          thirdParty: 'de terceros',
        },
        none: 'nada',
        note: 'Nada fuera de esta lista está instalado, y nada aquí puede alcanzar algo que su propia fila no nombre — sin acceso arbitrario a archivos, sin shell, sin red más allá de lo listado.',
      },
      capabilityLabels: {
        fsRead: 'Leer archivos',
        fsWrite: 'Escribir archivos',
        netHttp: 'Usar la red',
        systemNotify: 'Mostrar notificaciones',
        systemClipboard: 'Usar el portapapeles',
      },
      installMore: {
        title: 'Instalar más',
        installFromFile: {
          label: 'Instalar desde un archivo',
          hint: 'Añade un componente de terceros a esta versión.',
        },
        note: 'El entorno aislado donde estos componentes se ejecutarían está diseñado y documentado pero aún no construido, así que nada fuera de los {count} listados arriba puede instalarse todavía.',
      },
    },

    security: {
      title: 'Modelo de permisos',
      copy: 'Un componente no puede acceder a tus archivos, tu red ni tu portapapeles a menos que su manifiesto lo declare y tú lo permitas — una vez por ejecución. Toda solicitud, permitida o rechazada, queda registrada donde puedes leerla.',
      thirdParty: {
        label: 'Componentes de terceros',
        hint: 'Si algo fuera de esta versión se puede instalar y ejecutar.',
        status: 'Todavía no es posible — el entorno aislado no está construido',
      },
      allowedInOpenWorkflow: {
        label: 'Permitido en el flujo de trabajo abierto',
        hint: 'Se borra en cuanto se cierra esta aplicación.',
        nothingAllowed: 'Nada permitido',
        allowed: '{count} permitidos',
      },
      fullDetail: {
        label: 'Detalle completo',
        hint: 'Qué se permitió, a qué, y qué no protege esto.',
      },
    },

    privacy: {
      collect: {
        title: 'Qué podría recopilar esta aplicación, y no recopila',
        telemetry: {
          label: 'Telemetría',
          hint: 'Datos de uso — qué funciones se usan, con qué frecuencia — enviados a un servidor para que un equipo pudiera priorizar su trabajo.',
        },
        crashReports: {
          label: 'Informes de fallos',
          hint: 'Una traza de pila y una versión de compilación, enviadas automáticamente cuando algo falla, para poder arreglarlo sin que tengas que reportarlo tú.',
        },
        analytics: {
          label: 'Analítica de uso',
          hint: 'Recuentos de funciones, duración de sesión, o cualquier otra cosa que convirtiera cómo usas esta aplicación en un número en el panel de otra persona.',
        },
        note: 'Las tres necesitarían un servidor al que enviarse. No hay ninguno — un interruptor de "apagado" aquí implicaría un mecanismo que no existe.',
      },
      account: {
        title: 'Cuenta',
        signIn: {
          label: 'Inicio de sesión',
          hint: 'Una identidad asociada a esta aplicación, como hace la mayoría del software con servidor.',
          status: 'Ninguno — no hay servidor al que iniciar sesión',
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

    notifications: {
      window: {
        title: 'En esta ventana',
        toast: {
          label: 'Notificaciones emergentes',
          hint: 'Un flujo de trabajo puede pedir mostrar una, usando la misma capacidad system.notify que cualquier otro permiso — declarada en su manifiesto y permitida antes de que aparezca nada.',
          shown: '{count} mostradas en esta sesión',
        },
        note: 'Se conservan hasta las 20 más recientes mientras la ventana está abierta; descartarlas vacía la lista. Cerrar la aplicación las olvida, igual que todo lo demás que no sea un proyecto guardado.',
      },
      notBuilt: {
        title: 'Aún no está construido',
        copy: 'No hay permiso de notificaciones del sistema operativo, ni correo, ni notificaciones push — nada te alcanza fuera de esta ventana. Tampoco está construido un historial de notificaciones anteriores a la sesión actual.',
      },
    },

    files: {
      disk: {
        title: 'Qué vive en el disco',
        projects: {
          term: 'Proyectos',
          detail:
            'archivos, donde tú elijas guardarlos — consulta Proyectos para la carpeta por defecto.',
        },
        preferences: {
          term: 'Preferencias',
          detail:
            'Almacenamiento del navegador en el origen propio de esta aplicación, no un archivo que puedas abrir directamente.',
        },
        componentData: {
          term: 'Datos de componentes',
          detail:
            'Ninguno. Cada componente de esta versión está integrado; nada se descarga ni se almacena en caché.',
        },
        logs: {
          term: 'Registros',
          detail:
            'Ninguno escrito en el disco. Un registro de ejecución se mantiene en memoria mientras la ventana está abierta y se descarta al cerrarla.',
        },
      },
      notBuilt: {
        title: 'Aún no está construido',
        copy: 'No hay forma de importar o exportar ajustes, ni de mover las preferencias entre equipos salvo volver a configurarlas allí. Un proyecto en sí ya es portátil — es un solo archivo — pero las preferencias de esta pantalla no lo son.',
      },
    },

    updates: {
      thisBuild: {
        title: 'Esta versión',
        channel: {
          label: 'Cómo llega una más reciente a este equipo',
          hint: 'Qué ocurre cuando se lanza una nueva versión.',
          fact: 'No hay canal de actualizaciones. Actualizar significa descargar un instalador nuevo e instalarlo sobre este.',
        },
      },
      verify: {
        title: 'Verificar lo que instalas',
        copy: 'Las versiones no están firmadas digitalmente, así que Windows avisará de un editor no reconocido — una advertencia acertada, ya que nada aquí demuestra quién produjo el archivo. Cada versión publica en su lugar un hash SHA-256, para comprobar un instalador antes de ejecutarlo.',
      },
      notBuilt: {
        title: 'Aún no está construido',
        copy: 'La comprobación automática de actualizaciones, los canales de actualización como mecanismo funcional y las descargas en segundo plano no están construidos. Hoy, comprobar si hay una versión nueva significa comprobarlo a mano.',
      },
    },

    account: {
      title: 'Sin cuentas',
      copy: 'No hay inicio de sesión, ni cuenta, ni servidor con el que hablar. Nada aquí tiene una suscripción, un plan, una sesión, o una lista de dispositivos que gestionar — cada proyecto y cada preferencia de esta pantalla vive en este equipo, y solo en este equipo.',
    },

    developer: {
      internals: {
        title: 'Detalles internos',
        developerMode: {
          label: 'Modo desarrollador',
          hint: 'Muestra los valores en bruto de las preferencias y un resumen compacto de cada componente cargado, más abajo.',
        },
      },
      currentPreferences: {
        title: 'Preferencias actuales',
      },
      loadedComponents: {
        title: 'Componentes cargados',
      },
      hidden: {
        title: 'Oculto por ahora',
        copy: 'Activa el modo desarrollador arriba para ver los valores en bruto de las preferencias y un resumen de cada componente cargado.',
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

    diagnostics: {
      rows: {
        version: 'Versión de Encastra',
        runtime: 'Runtime',
        protocolSchema: 'Esquema del protocolo de componentes',
        projectSchema: 'Esquema del formato de proyecto',
        components: 'Componentes instalados',
        platform: 'Plataforma',
        architecture: 'Arquitectura',
        gpu: 'GPU',
        userAgent: 'Agente de usuario del WebView',
        gpuUnknown: 'No se puede averiguar',
        platformUnknown: 'Desconocida',
        architectureUnknown: 'El WebView no la indica',
      },
      machine: {
        title: 'Este equipo y esta versión',
      },
      share: {
        title: 'Compartirlo',
        copy: {
          label: 'Copiar',
          hint: 'Copia al portapapeles todas las líneas de arriba.',
          button: 'Copiar',
          copied: 'Copiado',
          failed: 'No se pudo copiar',
        },
        export: {
          label: 'Exportar',
          hint: 'Guarda el mismo reporte como archivo de texto.',
          button: 'Exportar…',
        },
        note: 'Nada aquí incluye una ruta de proyecto, un valor de preferencia, ni un token — está pensado para poder pegarse en algún sitio público sin problema. El informe se copia y se exporta en inglés, para que cualquiera del proyecto pueda leerlo.',
      },
    },

    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Crea software a partir de piezas que realmente encajan.',
      },
      thisBuild: {
        title: 'Esta versión',
        componentProtocol: {
          label: 'Protocolo de componentes',
          hint: 'Qué debe cumplir el manifiesto de un componente para poder cargarse.',
        },
        projectFormat: {
          label: 'Formato de proyecto',
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
