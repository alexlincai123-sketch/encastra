/**
 * Español. Toda clave aquí debe existir también en inglés — lo comprueba `i18n.test.ts`. Una
 * clave que falta aquí simplemente recurre al inglés; una traducción dudosa no se incluye.
 */

import type { Messages } from '../index';

const es: Messages = {
  common: {
    close: 'Cerrar',
    dismiss: 'Descartar',
    choose: 'Elegir…',
    itCannot: 'No puede',
    recordingBadge: 'grabación',
  },

  sidebar: {
    ariaLabel: 'Secciones',
    running: ', en ejecución',
    items: {
      home: 'Inicio',
      builder: 'Constructor',
      library: 'Biblioteca',
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
      library: {
        title: 'Abrir desde tu biblioteca',
        detail: 'Lo que hiciste, recibiste o preparaste',
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
    // The menu a right-click opens on the canvas. Removing a step was always possible from
    // the keyboard; this is where somebody finds out that it is.
    menu: {
      label: 'Acciones del lienzo',
      duplicate: 'Duplicar',
      disable: 'Desactivar',
      enable: 'Activar',
      deleteStep: 'Eliminar el paso',
      deleteConnection: 'Eliminar la conexión',
      paste: 'Pegar',
      selectAll: 'Seleccionar todo',
    },
    keysHint:
      'Usa las flechas para moverte entre pasos, Intro para abrir un paso en el inspector, Escape para deseleccionar y Suprimir para eliminar el paso seleccionado.',
    a11y: {
      selected: '{name}, paso {index} de {total}, seleccionado.',
    },
    node: {
      notInstalled: 'No instalado.',
    },
    wire: {
      ops: {
        toText: 'como texto',
        intToFloat: 'como decimal',
        boolToInt: 'como número',
        intToBool: 'como sí/no',
        round: 'redondeado',
        parseInt: 'analizar número',
        parseFloat: 'analizar decimal',
        parseBool: 'analizar sí/no',
        parseJson: 'analizar JSON',
        stringifyJson: 'como texto',
        encodeJson: 'a JSON',
        decodeJson: 'desde JSON',
        readBytes: 'leer',
        writeTemp: 'a archivo',
        unwrapOption: 'puede estar ausente',
        map: 'cada uno',
      },
    },
  },

  publish: {
    heading: 'Preparar una publicación',
    intro:
      'Encastra lee el proyecto guardado como lo leería quien lo recibe y luego lo escribe en la carpeta que elijas, junto al documento que lo acompañaría. No se sube nada: no hay registro al que enviarlo ni cuenta con la que enviarlo.',
    saveFirst: 'Guarda el proyecto primero. Lo que se publica es el archivo, y todavía no existe.',
    saveChangesFirst:
      'Guarda los cambios primero. Lo que se publica es el archivo del disco, y ya no coincide con el lienzo.',
    sections: {
      about: 'Qué es esto',
      check: 'Qué ha encontrado Encastra',
      done: 'Dónde ha quedado',
    },
    fields: {
      title: {
        label: 'Nombre',
        hint: 'Cómo se llama en la página desde la que alguien decide.',
      },
      summary: {
        label: 'Resumen',
        hint: 'Una o dos frases: qué hace y para quién.',
      },
      namespace: {
        label: 'Tu espacio de nombres',
        hint: 'Un nombre de dominio invertido que controles, como dev.tunombre. Nadie lo ha comprobado — no hay cuentas —, así que es una afirmación, no una prueba.',
      },
      version: {
        label: 'Versión',
        hint: 'Numerada como 1.0.0. Una versión publicada no cambia nunca; un cambio recibe un número nuevo.',
      },
      kind: {
        label: 'Tipo',
        hint: 'Un proyecto está pensado para ejecutarse. Una plantilla, para desmontarla y cambiarla.',
      },
      licence: {
        label: 'Licencia',
        hint: 'Qué puede hacer otra persona con esto. Una parte cuya licencia entre en conflicto con esta se rechaza.',
      },
    },
    kinds: {
      project: 'Proyecto',
      template: 'Plantilla',
    },
    licences: {
      mit: 'MIT',
      'apache-2.0': 'Apache-2.0',
      'gpl-3.0-only': 'GPL-3.0-only',
      proprietary: 'Todos los derechos reservados',
    },
    derivedName: 'Se conocería como',
    freeOnly:
      'Gratis, y solo gratis. No hay proveedor de pagos ni cuenta a la que cobrar, así que un precio aquí sería un número que nada podría cobrar.',
    checking: 'Leyendo el proyecto…',
    checkAgain: 'Comprobar de nuevo',
    prepare: 'Preparar…',
    nothingFound: 'Nada de aquí impediría publicarlo.',
    notAnAudit:
      'Esto encuentra los errores lo bastante mecánicos como para encontrarlos. No es una auditoría de seguridad, y nadie ha hecho ninguna.',
    capabilities: {
      none: 'No pide nada fuera de sí mismo.',
      some: 'A quien lo instale se le preguntará, en cada ejecución, antes de poder usar:',
    },
    preparedInto: 'El proyecto y su documento de publicación están aquí:',
    nowhereToSend: 'Se quedan en este equipo. Todavía no hay adónde enviarlos.',
    problems: {
      namespaceMissing: 'Una publicación necesita un espacio de nombres.',
      namespaceShape: 'Un espacio de nombres es un dominio invertido, como dev.tunombre.',
      titleMissing: 'Una publicación necesita un nombre.',
      titleUnusable:
        'Este nombre no tiene letras ni números con los que construir un identificador.',
      summaryMissing: 'Una publicación necesita un resumen.',
      summaryShort: 'Unas pocas palabras no le dicen nada a quien decide. Di qué hace.',
      versionShape: 'Una versión se numera como 1.0.0.',
    },
  },
  library: {
    heading: 'Tu biblioteca',
    intro:
      'Todo lo que tienes: los proyectos que hiciste, lo que recibiste de otra persona y las carpetas que preparaste para entregar. Todo está en este ordenador. Nada se sincroniza, se sube ni se comparte con nadie.',
    import: 'Importar…',
    importTitle: 'Leer una carpeta de publicación que te han dado',
    importUnavailable: 'Necesita la aplicación de escritorio',
    search: {
      placeholder: 'Buscar',
      ariaLabel: 'Buscar en tu biblioteca',
    },
    sort: {
      label: 'Orden',
      name: 'Por nombre',
      recent: 'Más reciente',
      origin: 'Por su procedencia',
    },
    noMatches: 'Nada de aquí coincide con eso.',
    quarantined:
      'La lista anterior no se pudo leer, así que se apartó con el nombre {name} y se empezó una nueva. No se borró nada y ninguno de tus proyectos se tocó.',
    origin: {
      created: 'Hecho aquí',
      imported: 'Importado',
      prepared: 'Preparado',
    },
    status: {
      missing: {
        label: 'No está',
        detail:
          'Ya no hay nada donde esto apunta. Se movió o se borró fuera de Encastra, que es algo que puedes hacer: esta línea está desactualizada, no equivocada.',
      },
      changed: {
        label: 'Cambiado',
        detail:
          'El archivo está, pero su contenido no es el de la última vez que Encastra lo miró. Algo lo editó en otro sitio.',
      },
    },
    facts: {
      version: 'Versión',
      publisher: 'Editor',
      steps: 'Pasos',
      when: 'Última vez',
    },
    row: {
      opened: 'Abierto el {when}',
      added: 'Añadido el {when}',
      publisherClaim:
        '{publisher}: es lo que dice, no está verificado. No hay cuentas, así que nadie lo ha comprobado.',
      steps: {
        one: '{count} paso',
        other: '{count} pasos',
      },
    },
    reach: {
      none: 'No pide nada fuera de sí mismo.',
      someLabel: 'Pedirá acceso a:',
      asksEveryRun: 'Tenerlo aquí no concede nada de esto. Cada ejecución lo pregunta.',
    },
    actions: {
      open: 'Abrir',
      remove: 'Quitar…',
    },
    remove: {
      cancel: 'Conservar',
      keepsFile:
        'Esto solo lo quita de la lista. Tu archivo se queda exactamente donde lo pusiste.',
      forget: 'Quitarlo de la lista',
      importedNote:
        'Esta copia la hizo Encastra, así que puede borrarla. Tú decides: la copia se va o se queda donde está.',
      andDeleteCopy: 'Quitar y borrar la copia',
      keepCopy: 'Quitar y conservar la copia',
      refused:
        'Ese archivo es tuyo y se queda donde está. Encastra solo borra las copias que ha hecho ella misma.',
    },
    empty: {
      heading: 'Aquí todavía no hay nada',
      body: 'A esta lista llegan tres cosas, y cada una empieza con algo que haces tú.',
      ways: {
        created: 'Un proyecto que guardas se añade a la lista.',
        imported:
          'Una carpeta de publicación que te han dado se añade cuando la importas, después de que Encastra la lea y tú digas que sí.',
        prepared: 'Una carpeta que preparas para entregar se añade al prepararla.',
      },
      build: 'Construir algo',
      buildTitle: 'Abrir el constructor y empezar con un lienzo vacío',
    },
  },

  import: {
    heading: 'Recibir una publicación',
    intro:
      'Encastra ha leído la carpeta que elegiste como debe leerla quien la recibe: comprobó el archivo contra el documento que lo acompaña y volvió a pasar aquí la misma revisión que hizo el editor. No se ha escrito nada y no se ha ejecutado nada.',
    reading: 'Leyendo la carpeta…',
    confirm: 'Importar',
    nothing: 'nada',
    copiesNothingRuns:
      'Importar copia los archivos a tu biblioteca. No se ejecuta nada hasta que lo abras y pulses Ejecutar.',
    nothingWasTakenIn: 'No se ha recibido nada y no se ha cambiado nada en este ordenador.',
    sections: {
      what: 'Qué dice que es',
      integrity: 'Si el archivo es el que se describe',
      inside: 'Qué hay dentro',
      asks: 'Qué pediría',
      check: 'Qué encontró Encastra',
    },
    facts: {
      publisher: 'Editor',
      name: 'Se llama',
      version: 'Versión',
      kind: 'Tipo',
      licence: 'Licencia',
      size: 'Tamaño',
      kilobytes: '{size} kB',
      runtime: 'Se ejecuta en',
      projectName: 'Proyecto',
      steps: 'Pasos',
      stepCount: {
        one: '{count} paso',
        other: '{count} pasos',
      },
      switchedOff: ' ({count} apagados)',
      versions: 'Versiones guardadas',
      versionCount: {
        one: '{count} versión',
        other: '{count} versiones',
      },
    },
    kinds: {
      project: 'Proyecto',
      template: 'Plantilla',
      component: 'Componente',
    },
    notVerified:
      'Nadie ha comprobado que este editor sea quien dice el nombre. No hay cuentas, así que no hay nadie que pudiera haberlo hecho.',
    checksumMatches:
      'El archivo coincide con la suma de comprobación del documento que lo acompaña.',
    checksumIsNotProvenance:
      'Eso demuestra que el archivo no se ha modificado desde que se preparó. No dice nada sobre quién lo preparó.',
    capabilities: {
      none: 'No pide nada fuera de sí mismo.',
      some: 'Al ejecutarse pedirá usar:',
      grantsNothing:
        'Importar no concede nada de esto. Cada ejecución lo pregunta antes de tocar nada.',
    },
    nothingFound: 'Aquí no hay nada que impida recibirlo.',
    notAnAudit:
      'Esto encuentra los errores lo bastante mecánicos como para encontrarlos. No es una auditoría de seguridad, y nadie ha hecho ninguna.',
    disagreement: {
      declared: 'El documento dice',
      actual: 'El proyecto pide',
    },
    tokens: {
      title: 'título',
      summary: 'resumen',
      changelog: 'lista de cambios',
      publisher: 'editor',
      categories: 'categorías',
      tags: 'etiquetas',
      runtime: 'motor de ejecución',
    },
    errors: {
      notAFolder:
        'Eso no es una carpeta. Una publicación es una carpeta con un proyecto y el documento que lo describe.',
      folderIsALink:
        'Esa carpeta es un enlace a otro sitio. Encastra no lo sigue, porque entonces lo que leería y lo que tú elegiste no serían lo mismo. Elige la carpeta en sí.',
      folderNotChosen:
        'Esa carpeta no se eligió en esta sesión. Selecciónala con el selector de carpetas, para que lo que Encastra lee sea lo que tú señalaste.',
      noDocument:
        'No hay ningún publication.json en esa carpeta, así que nada dice qué es. Eso es una carpeta con archivos, no una publicación.',
      documentIsALink:
        'publication.json es un enlace a otro archivo, no un archivo. Encastra lee lo que hay en la carpeta que elegiste y nada de fuera.',
      documentTooLarge:
        'publication.json ocupa unos {size} kB y esta versión lee como mucho {max} kB. Un documento de publicación es una página de texto; uno así de grande no lo es.',
      documentUnreadable:
        'No se pudo leer publication.json: {reason}. Pide a quien lo preparó que vuelva a prepararlo.',
      noProject:
        'No hay ningún archivo .encastra en esa carpeta. Una publicación es un proyecto y el documento que lo describe.',
      moreThanOneProject:
        'Una publicación es un solo proyecto, y esa carpeta tiene {count}: {names}. Quien la preparó debería enviar una carpeta por proyecto.',
      projectIsALink:
        'El archivo del proyecto es un enlace a otro archivo, no un archivo. Encastra instala lo que hay en la carpeta que elegiste y nada de fuera.',
      unexpectedEntries:
        'Una carpeta de publicación tiene un documento y un proyecto, y nada más. Esta tiene además {names}. Encastra no recibe una carpeta de la que no puede dar cuenta.',
      tooManyEntries:
        'Una carpeta de publicación tiene un documento y un proyecto, y nada más. Esta tiene más de {max} entradas, y eso no es una publicación sean lo que sean.',
      projectTooLarge:
        'El proyecto ocupa unos {size} kB y esta versión instala como mucho {max} kB.',
      checksumMismatch:
        'El archivo del proyecto no es el que describe esta publicación. O el documento describe otro archivo, o el archivo cambió por el camino. Pídelo otra vez.',
      projectUnreadable:
        'No se pudo leer el archivo del proyecto: {reason}. Puede que lo haya hecho una versión más nueva de Encastra, o que se haya dañado por el camino.',
      notInstallable:
        'Esta versión no puede instalar un {publicationKind}, así que no va a fingir que sí.',
      notAListingId:
        '«{id}» no es un nombre de publicación, así que no hay un nombre seguro bajo el que archivarlo.',
      notAVersion: '«{version}» no es una versión. Las publicaciones se numeran como 1.2.0.',
      notPublishersNamespace:
        '«{listing}» no está dentro del espacio de nombres de {publisher}. El documento nombra a un editor y una publicación que pertenece a otro, y Encastra no puede saber cuál de los dos es el error.',
      textTooLong:
        'El {field} es más largo de lo que esta versión lee (como mucho {max} caracteres).',
      textHasControlCharacters:
        'El {field} tiene caracteres que pueden ocultar lo que realmente dice: de los que hacen que un nombre parezca otro. Encastra lo rechaza en vez de reescribir en silencio lo que alguien escribió.',
      documentDisagreesWithProject:
        'El documento y el proyecto no coinciden en el {about}. La página que describe esto está describiendo algo distinto del archivo que la acompaña.',
      runtimeIncompatible:
        'Esta publicación es para un motor {requires} y este es {have}. No se instala nada para una versión para la que no se hizo.',
      reviewRefused:
        'La misma revisión que hizo su editor lo rechaza aquí. Esto tendría que cambiar antes de que alguien pudiera recibirlo:',
      capabilitiesDisagree:
        'El documento y el proyecto no coinciden en lo que esto pide. Quedarse corto con los permisos es el problema obvio; pasarse enseña a la gente a leer la lista por encima, que es el sutil. Los dos se rechazan.',
      alreadyImported:
        '{listing} {version} ya está en tu biblioteca. Una versión publicada nunca cambia, así que aquí no hay nada nuevo que recibir.',
      io: 'Algo en este ordenador rechazó la operación ({reason}). No se recibió nada.',
      unknown:
        'Encastra rechazó esta carpeta por un motivo para el que esta versión no tiene palabras. No se recibió.',
    },
  },

  toolbar: {
    publish: 'Publicar',
    publishTitle: 'Preparar este proyecto para que otra persona lo instale',
    preview: {
      badge: 'vista previa',
      title: 'No hay ningún motor de ejecución conectado a esta ventana.',
    },
    new: 'Nuevo',
    open: 'Abrir',
    save: 'Guardar',
    unsavedChanges: 'Cambios sin guardar',
    check: 'Comprobar',
    stop: 'Detener',
    run: 'Ejecutar',
    startWatching: 'Empezar a vigilar',
    watching: 'Vigilando',
    recordedRuns: {
      everythingAllowed: 'Grabación: todo permitido',
      folderNotAllowed: 'Grabación: la carpeta no se permitió',
    },
    notifications: {
      more: '{count} más',
    },
    status: {
      steps: {
        one: '{count} paso',
        other: '{count} pasos',
      },
      running: 'en ejecución',
      runs: {
        one: '{count} ejecución',
        other: '{count} ejecuciones',
      },
      waiting: '{count} en espera',
      ok: {
        one: '{count} correcto',
        other: '{count} correctos',
      },
      failed: {
        one: '{count} fallido',
        other: '{count} fallidos',
      },
      skipped: {
        one: '{count} omitido',
        other: '{count} omitidos',
      },
    },
  },

  components: {
    header: {
      title: 'Componentes',
      summary: '{count} instalados.',
      summaryWithTriggers:
        '{count} instalados — {triggerCount} de ellos inician un flujo de trabajo por su cuenta; el resto se ejecuta como un paso dentro de uno.',
      note: 'Todo esto viene incluido con la aplicación; instalar otros necesita el entorno aislado para código de terceros, que todavía no está construido.',
    },
    search: {
      placeholder: 'Buscar',
      ariaLabel: 'Buscar componentes',
    },
    filters: {
      categoryLegend: 'Categoría',
    },
    empty: 'Nada coincide con eso.',
    card: {
      triggerBadge: 'inicia un flujo de trabajo',
      triggerNote:
        'Una fuente de eventos, no un paso — esto inicia una ejecución en vez de ejecutarse dentro de una.',
      noDescription: 'Este componente no ha documentado qué hace.',
      takes: 'Toma',
      gives: 'Da',
      addToCanvas: 'Añadir al lienzo',
    },
    reach: {
      label: 'Puede alcanzar',
      none: 'No alcanza nada fuera de este flujo de trabajo',
      verb: {
        fsRead: 'Lee archivos',
        fsWrite: 'Escribe archivos',
        netHttp: 'Usa la red',
        systemClipboard: 'Usa el portapapeles',
        systemNotify: 'Muestra notificaciones',
      },
      cannot: {
        fsRead: 'leer tus archivos',
        fsWrite: 'escribir archivos',
        netHttp: 'usar la red',
        systemClipboard: 'usar el portapapeles',
        systemNotify: 'mostrar notificaciones',
      },
    },
  },

  security: {
    title: 'Seguridad',
    intro:
      'Los componentes no pueden acceder a tus archivos, tu red ni tu portapapeles a menos que un manifiesto lo declare y tú lo permitas. Los permisos se conceden por ejecución, y toda solicitud — permitida o rechazada — queda registrada donde puedes leerla.',
    installed: {
      title: 'Componentes instalados',
      headers: {
        component: 'Componente',
        version: 'Versión',
        origin: 'Origen',
        canReach: 'Puede alcanzar',
      },
      builtIn: 'incluido de fábrica',
      nothing: 'nada',
      thirdPartyNote:
        'Nada aquí procede de fuera de esta aplicación. Los componentes de terceros se ejecutarían en un entorno aislado de WebAssembly sin autoridad ambiental; ese entorno está diseñado y documentado, pero {notBuilt}, así que instalarlos todavía no es posible.',
      thirdPartyNoteEmphasis: 'no está construido',
    },
    grants: {
      title: 'Permitido en el flujo de trabajo abierto',
      empty:
        'No se ha permitido nada. Un flujo de trabajo que necesite una carpeta lo pedirá antes de ejecutarse.',
      note: 'Esto dura solo esta sesión. Cerrar la aplicación lo olvida, así que un flujo de trabajo que no hayas mirado en un mes no puede seguir escribiendo en algún sitio.',
    },
    privacy: {
      title: 'Privacidad',
      telemetry: { label: 'Telemetría', value: 'Ninguna. No se recopila ni se envía nada.' },
      crashReports: { label: 'Informes de fallos', value: 'Ninguno.' },
      accounts: { label: 'Cuentas', value: 'Ninguna. No hay inicio de sesión ni servidor.' },
      yourFiles: {
        label: 'Tus archivos',
        value:
          'Nunca salen de este equipo, a menos que un flujo de trabajo que hayas creado los envíe a algún sitio.',
      },
      runJournals: {
        value:
          'Registran tamaños y formas, nunca el contenido de los archivos. Un registro se mantiene en memoria mientras la ventana está abierta y visible; nada se escribe en disco, y cerrar la aplicación lo descarta.',
      },
    },
    limits: {
      title: 'Contra qué no protege esto',
      misuse:
        'Un componente al que le concedes un acceso amplio puede abusar de él. El diálogo puede hacer que esa decisión esté informada; no puede hacerla imposible.',
      trustedBase:
        'Los componentes incluidos de fábrica se ejecutan como código nativo ordinario. Están limitados por el intermediario de permisos, pero un fallo en uno es un fallo en la base de confianza.',
      noAudit:
        'Esta versión no ha tenido una auditoría de seguridad externa. Eso es un requisito para distribuir componentes escritos por otras personas, no para ejecutar tus propios flujos de trabajo.',
      unsigned:
        'Nada aquí está firmado todavía, así que esta versión no puede demostrar que no se ha alterado.',
      previewOnly:
        'Esto es una vista previa en el navegador, sin ningún motor de ejecución conectado.',
    },
    footer:
      'Motor {runtime} · esquema de protocolo {protocolSchema} · esquema de proyecto {projectSchema}',
  },

  inspector: {
    problemsTitle: 'Problemas',
    projectTitle: 'Proyecto',
    selectStep: 'Selecciona un paso para configurarlo, o elige un componente para empezar.',
    component: 'Componente',
    switchOn: 'Activar',
    switchOff: 'Desactivar',
    settingsTitle: 'Ajustes',
    nothingChosen: 'Nada elegido',
    entryInputs: {
      title: 'Material de partida',
      doc: 'Nada en el grafo produce esto, así que la ejecución lo necesita de ti.',
    },
    permissions: {
      title: 'Permisos',
      none: 'Este componente no pide nada. Solo trabaja con lo que le entrega el grafo, y no puede acceder a tus archivos, la red ni el portapapeles.',
      allowed: 'Permitido',
      allowFolder: 'Permitir esta carpeta',
      allowHost: 'Permitir {host}',
      allowAddress: 'Permitir esta dirección',
      allow: 'Permitir',
      chooseFolderFirst: 'Elige antes una carpeta.',
      enterAddressFirst: 'Introduce antes una dirección.',
      notASetting:
        'No es un ajuste — el componente nunca declaró esto, así que el motor lo rechaza sin importar lo que permitas aquí.',
    },
    versions: {
      title: 'Versiones',
      titleWithCount: 'Versiones · {count}',
      empty:
        'Guarda este proyecto para empezar a conservar versiones. Cada guardado registra una, y nada se sobrescribe jamás.',
      currentVersionTitle: 'Esta es la versión actual.',
      restoreTitle: 'Restaurar esta. Se añade como una versión nueva; nada se pierde.',
      current: 'Actual',
      versionNumber: 'Versión {number}',
      restore: 'Restaurar',
    },
    runRecord: {
      title: 'Última ejecución',
      code: 'Código: {code}',
      neverRan: 'Este paso nunca se ejecutó, porque {name} no terminó.',
      status: 'Estado',
      took: 'Tardó',
      in: 'entra {port}',
      out: 'sale {port}',
      permissionsUsed: 'Permisos usados',
      refused: ' · {count} rechazados',
      logs: 'Registro',
    },
  },

  runPanel: {
    ariaLabel: 'Ejecución',
    title: 'Ejecución',
    recordingTitle:
      'Esta es una ejecución grabada, reproducida para el depurador. No acaba de ocurrir en este equipo.',
    empty:
      'Todavía no se ha ejecutado nada. Pulsa Ejecutar arriba y cada paso aparecerá aquí, en el orden en que el motor los ejecuta, con su estado y cuánto tardó — o, si uno falla, qué salió mal y qué hacer al respecto.',
    status: {
      pending: 'En espera',
      running: 'En ejecución',
      ok: 'Terminado',
      failed: 'Fallido',
      skipped: 'Omitido',
      cancelled: 'Cancelado',
      disabled: 'Desactivado',
    },
    outcome: {
      watching: 'Vigilando cambios…',
      running: 'Ejecutando…',
      finished: 'Terminado.',
      finishedIn: 'Terminado en {took}.',
      partial: {
        one: '{count} paso falló. El resto del grafo se ejecutó igualmente.',
        other: '{count} pasos fallaron. El resto del grafo se ejecutó igualmente.',
      },
      failed: 'Nada se completó.',
      cancelled: 'Detenido.',
    },
    watch: {
      runsSoFar: {
        one: '{count} ejecución hasta ahora',
        other: '{count} ejecuciones hasta ahora',
      },
      pendingWaiting: '{count} en espera',
    },
    step: {
      neverRan: 'Nunca se ejecutó — {name} no terminó.',
    },
  },

  onboarding: {
    tour: {
      stepCount: 'Paso {current} de {total}',
      done: 'Hecho — continúa cuando quieras.',
      waiting: 'Esperando a que lo pruebes.',
      finish: 'Terminar',
      next: 'Siguiente',
      canvas: {
        title: 'Este es tu lienzo',
        body: 'Un flujo de trabajo son unos pocos componentes unidos entre sí. Todo se ejecuta en este equipo, y nada accede a tus archivos hasta que lo permitas.',
      },
      addFirst: {
        title: 'Añade el primer paso',
        body: 'A la izquierda está cada componente instalado. Busca Vigilar carpeta y añádelo — inicia el flujo de trabajo cada vez que aparece un archivo donde tú elijas.',
      },
      addSecond: {
        title: 'Añade algo que hacer',
        body: 'Ahora añade Redimensionar imagen. Toma una imagen y hace una copia más pequeña, sin tocar la original.',
      },
      connect: {
        title: 'Únelos entre sí',
        body: 'Arrastra desde el puerto de archivo de Vigilar carpeta hasta el puerto de imagen de Redimensionar imagen. Un archivo todavía no es una imagen, así que el editor inserta el paso que lo abre — y rechaza la unión directamente si los dos nunca pudieran encajar.',
      },
      configure: {
        title: 'Dile qué carpeta',
        body: 'Selecciona un paso para configurarlo a la derecha. Vigilar carpeta necesita saber qué carpeta vigilar, y Guardar archivo necesita saber dónde poner el resultado.',
      },
      allow: {
        title: 'Permítele esa carpeta',
        body: 'Un componente no puede tocar nada hasta que tú lo digas, y un permiso se limita a la única carpeta que elijas. Pulsa Permitir en el paso que lo pidió.',
      },
      run: {
        title: 'Ejecútalo',
        body: 'Pulsa Ejecutar, o Ctrl+Intro. Cada paso se ilumina al ocurrir, y el panel de abajo registra qué hizo y cuánto tardó.',
      },
    },
    welcome: {
      title: 'Bienvenido a Encastra',
      lead: 'Crea software ensamblando componentes. Eliges las piezas, las conectas y pulsas ejecutar — en este equipo, sin que nada acceda a tus archivos hasta que lo permitas.',
      createFirst: {
        title: 'Crea tu primer flujo de trabajo',
        note: 'Un recorrido guiado breve, de un minuto aproximadamente',
      },
      exploreSample: {
        title: 'Explora un ejemplo',
        note: '{name}, ya construido — tú eliges sus carpetas',
      },
      skip: {
        title: 'Omitir',
        note: 'Ve directo al grano. Esto está en Ajustes por si lo quieres más tarde.',
      },
    },
  },

  messages: {
    untitledProject: 'Sin título',
    recordingNote: 'Esta es una grabación, no una ejecución en este equipo.',
    problemsToFix: {
      one: '{count} problema por resolver.',
      other: '{count} problemas por resolver.',
    },
    readyToRun: 'Este grafo está listo para ejecutarse.',
    nothingRanProblems: {
      one: 'Nada se ejecutó: {count} problema por resolver primero.',
      other: 'Nada se ejecutó: {count} problemas por resolver primero.',
    },
    saved: {
      one: 'Guardado. {count} versión conservada.',
      other: 'Guardado. {count} versiones conservadas.',
    },
    watchingChanges: 'Vigilando. Se ejecutará en cuanto aparezca algo.',
    running: 'En ejecución.',
    stopping: 'Deteniendo.',
    demoLoaded: '{name}: rellena {needs}, y después inícialo.',
    restored: 'Restaurado. La versión desde la que venías sigue en el historial.',
    missingComponents: 'Este proyecto necesita {missing}, que no está instalado.',
    runtimeSilent: 'Algo en el motor no respondió.',
    libraryMissing:
      '{name} no está donde estaba. Vuelve a ponerlo ahí o ábrelo desde donde esté ahora.',
    imported: 'Recibido {name}. No se ha ejecutado nada.',
    removedFromLibrary: '{name} ya no está en la lista. El archivo sigue donde estaba.',
    removedAndDeleted: '{name} ya no está en la lista, y la copia que hizo Encastra se ha borrado.',
  },

  demos: {
    imageProcessor: {
      name: 'Procesador de imágenes',
      summary:
        'Vigila una carpeta. Cada vez que aparece una imagen, hace una copia más pequeña en otra carpeta.',
      needs: {
        watch: 'Una carpeta que vigilar',
        save: 'Una carpeta donde guardar',
      },
    },
    fileOrganiser: {
      name: 'Organizador de archivos',
      summary:
        'Vigila una carpeta y mueve lo que llega a ella a una de otras tres, según el tipo de archivo.',
      needs: {
        watch: 'Una carpeta que vigilar',
        images: 'Una carpeta para imágenes',
        documents: 'Una carpeta para documentos',
      },
    },
    thumbnails: {
      name: 'Miniaturas',
      summary:
        'Convierte una carpeta de imágenes en vistas previas cuadradas, listas para una galería o una cuadrícula.',
      needs: {
        watch: 'Una carpeta que vigilar',
        save: 'Una carpeta donde guardar',
      },
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
