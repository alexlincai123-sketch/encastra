import type { Messages } from '../messages';

/**
 * Español. Toda clave de aquí debe existir también en `en.ts` — lo comprueba `test/i18n.test.ts`
 * en ambas direcciones. Una clave que falta aquí simplemente recurre al inglés (ver
 * `translate.ts`); una traducción dudosa no se incluye.
 *
 * Nombres propios del producto — Encastra, los nombres de componentes reales (Watch Folder,
 * Resize Image, Save File...), nombres de plantillas (Image Processor), identificadores de tipo
 * (FILE, IMAGE), extensión .encastra, SHA-256 — se dejan tal cual: son los mismos nombres que usa
 * el producto en cualquier idioma, no vocabulario a traducir.
 */
const es: Messages = {
  a11y: {
    skipToContent: 'Saltar al contenido',
  },

  header: {
    navAriaLabel: 'Principal',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    download: 'Descargar',
  },

  nav: {
    primary: {
      features: 'Funciones',
      howItWorks: 'Cómo funciona',
      components: 'Componentes',
      templates: 'Plantillas',
      learn: 'Aprender',
      security: 'Seguridad',
      ecosystem: 'Ecosistema',
    },
    footer: {
      groups: {
        product: 'Producto',
        learn: 'Aprender',
        ecosystem: 'Ecosistema',
        legal: 'Legal',
      },
      items: {
        features: 'Funciones',
        howItWorks: 'Cómo funciona',
        components: 'Componentes',
        templates: 'Plantillas',
        download: 'Descargar',
        pricing: 'Precios',
        tutorials: 'Tutoriales',
        docs: 'Documentación',
        security: 'Seguridad',
        ecosystem: 'Ecosistema',
        marketplace: 'Marketplace',
        community: 'Comunidad',
        about: 'Acerca de',
        contact: 'Contacto',
        allDocuments: 'Todos los documentos',
        privacy: 'Privacidad',
        terms: 'Términos',
        reportVulnerability: 'Reportar una vulnerabilidad',
      },
    },
  },

  footer: {
    navAriaLabel: 'Pie de página',
    versionLine: 'Beta {version} · Solo Windows · las versiones no están firmadas',
    legal: {
      namePrefix:
        'Encastra es un nombre provisional. No se han revisado los registros de marcas, así que nada aquí afirma que el nombre esté legalmente libre —',
      nameLinkText: 'por qué queda escrito aquí',
      licencePrefix:
        'No se ha elegido ninguna licencia para el código fuente. Los documentos legales de este sitio son',
      licenceLinkText: 'borradores sin revisar',
    },
  },

  theme: {
    changeTheme: 'Cambiar tema',
    switchTo: 'Cambiar a tema {theme}',
    light: 'claro',
    dark: 'oscuro',
  },

  language: {
    label: 'Idioma',
    switchTo: 'Cambiar a {language}',
  },

  status: {
    built: 'Disponible',
    preview: 'Vista previa',
    designed: 'Diseñado, no construido',
    planned: 'Sin construir',
  },

  site: {
    tagline: 'Crea software ensamblando componentes.',
    description:
      'Encastra es una aplicación de escritorio local-first que ejecuta un grafo tipado de componentes. Elige componentes, conéctalos, concede permisos, pulsa ejecutar. Todo ocurre en tu equipo.',
  },

  home: {
    whatExists: {
      eyebrow: 'Lo que existe hoy',
      title: 'Un motor que funciona, no una maqueta',
      lead: 'Cada afirmación de las escenas anteriores es una prueba real o un componente que puedes abrir en la paleta. Lo que está diseñado pero no construido se etiqueta así, en el mismo sitio, siempre.',
      runtime: {
        title: 'Runtime',
        body: 'Validación, planificación, aplicación de permisos, y un registro de lo que se ejecutó.',
      },
      capabilityBroker: {
        title: 'Broker de permisos',
        body: 'El único código que toca la autoridad del sistema operativo — incluso para los componentes que trae la aplicación.',
      },
      projectFormat: {
        title: 'Formato de proyecto',
        body: 'Un archivo .encastra determinista: el grafo, su lockfile, sus variables, su historial de versiones.',
      },
      thirdParty: {
        title: 'Componentes de terceros',
        body: 'El sandbox de WebAssembly está diseñado y documentado. Todavía no se ejecuta nada de terceros.',
      },
    },
    availability: {
      eyebrow: 'Disponibilidad',
      title: 'Sólo Windows, por ahora',
      lead: 'Encastra funciona en Windows 10 y 11 de 64 bits. No hay versión para macOS ni para Linux — no es «próximamente» ni hay lista de espera: no existen, y un botón de descarga que no diera nada sería peor que decirlo.',
      platforms: {
        windows: {
          name: 'Windows',
          detail: '10 y 11 · x64 · instalador por usuario, sin permisos de administrador',
          state: 'Disponible',
        },
        macos: {
          name: 'macOS',
          detail:
            'Sin construir. El runtime es Rust portable, así que es cuestión de trabajo, no de posibilidad.',
          state: 'No disponible',
        },
        linux: {
          name: 'Linux',
          detail: 'Sin construir, por la misma razón.',
          state: 'No disponible',
        },
      },
      note: 'El instalador no está firmado, así que Windows avisará de un editor desconocido. Ese aviso es cierto. El SHA-256 publicado es lo que tienes en lugar de una firma.',
    },
    closing: {
      eyebrow: 'Beta {version}',
      title: 'Solo Windows, sin firmar, y sincero sobre ambas cosas',
      lead: 'SmartScreen avisará de un editor no reconocido. El aviso es acertado — nada en el archivo demuestra quién lo construyó. El SHA-256 publicado es lo que tienes en su lugar.',
      downloadAndVerify: 'Descargar y verificar',
      readSecurityModel: 'Leer el modelo de seguridad',
      browseComponents: 'Explorar todos los componentes',
    },
  },

  ui: {
    source: 'Fuente',
    notBuiltBlockedByTitle: 'Qué tiene que pasar antes',
  },

  graph: {
    needsPermission: 'necesita tu permiso',
    routesTo: 'enruta a',
    required: 'obligatorio',
    state: {
      running: 'ejecutando',
      ok: 'ok',
      failed: 'fallido',
      skipped: 'omitido',
    },
  },

  terminal: {
    caption: 'Demostración grabada, no es una terminal en directo',
    transcriptIntro:
      'Transcripción grabada de la terminal, aquí completa para tecnologías de asistencia:',
    controlsLegend: 'Controles de reproducción',
    play: 'Reproducir',
    pause: 'Pausar',
    restart: 'Reiniciar',
    speed: 'Velocidad de reproducción, ahora {speed}×. Púlsalo para cambiarla.',
    reducedNote:
      'Tienes activado el movimiento reducido, así que se muestra la transcripción terminada en lugar de escribirla letra a letra.',
  },

  notFound: {
    eyebrow: '404',
    title: 'Esta página no existe',
    lead: 'La dirección que has seguido no corresponde a ninguna página de este sitio. Puede estar mal escrita, o apuntar a algo que nunca se construyó.',
    home: 'Ir a la página de inicio',
    docs: 'Leer la documentación',
  },

  permissionMock: {
    allowed: 'Permitido',
    allowFolder: 'Permitir esta carpeta',
    allow: 'Permitir',
  },

  download: {
    meta: {
      description:
        'El instalador de Windows para Encastra {version} — tamaño, SHA-256 y qué comprobar antes de ejecutarlo. macOS y Linux todavía no están construidos.',
    },
    hero: {
      eyebrow: 'Descarga',
      title: 'Consigue la beta',
      lead: 'Un instalador, para Windows, sin firmar. Todavía no existe nada más — sin build de macOS, sin build de Linux, sin actualización automática.',
    },
    target: {
      windowsTitle: 'Esto parece Windows',
      windowsBody:
        'El instalador de abajo debería funcionar aquí. Sigue sin estar firmado — mira la nota más abajo antes de ejecutarlo.',
      otherTitle: 'Esto parece {label}',
      otherBody:
        'Todavía no hay build de {label}. Los componentes declaran soporte para esta plataforma y el motor está escrito para ser independiente de la plataforma, pero solo el instalador de Windows se ha construido, empaquetado y probado de verdad.',
      macos: 'macOS',
      linux: 'Linux',
    },
    versionMismatch: {
      title: 'Este sitio documenta {version}; la build publicada es {release}',
      body: 'La versión {version} es la release de la que forma parte esta web — añade el propio sitio, la incorporación, correcciones de accesibilidad y documentación. No cambia el runtime, el sistema de tipos, el broker de permisos, el formato de proyecto ni la CLI, que son el mismo motor que trajo {release}. El instalador de abajo es el artefacto real y construido; todavía no se ha producido un instalador de la {version}.',
    },
    platforms: {
      windowsBadge: 'Windows — disponible',
      windowsTitle: 'Windows 10 / 11, x64',
      windowsBody:
        'Instalador NSIS, por usuario, sin necesidad de administrador. Este es el único artefacto que existe de verdad.',
      noHostYet: 'Todavía sin servidor público de descarga',
      macosTitle: 'macOS',
      macosBody:
        'Los componentes declaran soporte para macOS y el motor está escrito para ser independiente de la plataforma, pero no se ha construido ni empaquetado nada de verdad para esta plataforma.',
      linuxTitle: 'Linux',
      linuxBody: 'La misma historia que macOS: soporte declarado, sin build, nada que descargar.',
    },
    noHostCallout: {
      part1:
        'Todavía no hay ningún servidor público de descarga para esta build — el repositorio no es público y',
      part2: 'no está registrado (mira',
      part3:
        '). Lo que sigue es el registro real de la build que existe: su nombre de archivo exacto, tamaño y SHA-256, tomados de',
      part4:
        ', para que quien la aloje — o te pase una copia directamente — pueda verificarla contra esto.',
    },
    thisBuild: {
      eyebrow: 'Esta build',
      installer: 'Instalador',
      size: 'Tamaño',
      format: 'Formato',
      built: 'Construido',
      builtOn: '{date} en {target}',
      commit: 'Commit',
      codeSigned: 'Firmado',
      yes: 'Sí',
      no: 'No',
      sha256Label: 'SHA-256 de {file}:',
      verifyLabel: 'Verifícalo en Windows antes de ejecutarlo:',
    },
    notSigned: {
      title: 'Esta build no está firmada',
      body: 'Windows SmartScreen avisará de un editor no reconocido, y el aviso es acertado — nada en el archivo demuestra quién lo construyó. El SHA-256 de arriba demuestra que el archivo no se alteró entre donde lo conseguiste y aquí; no demuestra nada sobre quién lo produjo. Los dos hechos van juntos.',
    },
    requirements: {
      eyebrow: 'Requisitos del sistema',
      title: 'Qué necesita',
      os: 'Sistema operativo',
      disk: 'Disco',
      network: 'Red',
      install: 'Instalación',
    },
    afterInstall: {
      eyebrow: 'Después de instalar',
      title: 'Lo que todavía no hay',
      bodyPrefix:
        'Nada se actualiza solo — una versión nueva significa descargar un instalador nuevo y ejecutarlo, una vez que se publique en algún sitio. Desinstalar quita solo la aplicación; no toca ningún archivo',
      bodySuffix: 'que vive donde lo hayas guardado.',
    },
  },

  security: {
    meta: {
      description:
        'Lo que aplica el broker de permisos, lo que pide cada componente de origen propio, lo que está deliberadamente ausente y — dicho con la misma franqueza que el documento fuente — lo que nada de esto protege.',
    },
    hero: {
      eyebrow: 'Seguridad',
      title: 'El modelo de permisos, con sus límites',
      lead: 'Esta página no afirma que el producto sea seguro. Describe lo que el broker de permisos aplica de verdad, y — con la misma franqueza que sus puntos fuertes — lo que no.',
    },
    reviewed: {
      title: 'Revisado, no auditado',
      body: 'Encastra ha pasado una revisión de seguridad por parte de quienes lo escribieron. Nadie más lo ha revisado externamente todavía, y el límite del sandbox que más importa para el código de un desconocido no existe en esta build. Una auditoría externa es un requisito previo antes de que pueda lanzarse algo parecido a un marketplace.',
    },
    broker: {
      eyebrow: 'El broker',
      title: 'Una sola puerta, para cada componente, incluidos los que trae el producto',
      lead: 'crates/encastra-core/src/broker.rs es el único código del runtime que toca la autoridad del sistema operativo. Un componente del núcleo que no declare fs.read no puede abrir un archivo, porque se lo pide al broker y el broker lo rechaza — hay una prueba que lo demuestra. Hacer pasar el código de confianza por la misma puerta que el que no lo es significa que el diálogo de permisos no puede mentir sobre lo que aplica.',
    },
    scopes: {
      inputHandles: {
        scope: 'InputHandles',
        body: 'Solo lo que el grafo conectó a los puertos de este nodo. No hace falta decidir nada — no añade nada que no hayas dicho ya al dibujar una línea.',
      },
      directory: {
        scope: 'Directory(path)',
        body: 'Una carpeta que elegiste. Nada fuera de ella. Los symlinks se resuelven, no se siguen hacia fuera.',
      },
      httpHosts: {
        scope: 'HttpHosts(list)',
        body: 'Los hosts exactos que permitiste. Una lista vacía no es «todos los hosts» — es ningún host.',
      },
      allowed: {
        scope: 'Allowed',
        body: 'Un sí llano, para un permiso sin nada que parametrizar, como mostrar una notificación.',
      },
    },
    asksFor: {
      eyebrow: 'Lo que pide cada componente',
      title: 'Ningún componente pide más de lo que su trabajo necesita',
      lead: 'Esta tabla es también una prueba: nothing_first_party_quietly_asks_for_more_than_it_needs guarda la misma lista en código y hace fallar la build si los permisos declarados de un componente cambian sin que el cambio sea deliberado.',
      component: 'Componente',
      asksForColumn: 'Pide',
      scopeColumn: 'Ámbito',
      sourceNote: '§7, con el razonamiento completo',
    },
    absent: {
      eyebrow: 'Deliberadamente ausente',
      title: 'Esto no está denegado. No existe.',
      lead: 'Cuatro permisos que un componente podría pedir de forma plausible, y por qué ninguno puede concederse en esta build.',
      processExecution: {
        title: 'Ejecución de procesos',
        body: 'No hay ningún permiso process.* en ningún sitio de la build. El validador de manifiestos mantiene una lista blanca de cinco tipos de permiso y rechaza cualquier otro. Ningún diálogo de consentimiento puede llegar a ofrecer uno.',
      },
      webhookListener: {
        title: 'Un listener de webhooks',
        body: 'Recibir una petición significa escuchar en un puerto, que es una pregunta de seguridad distinta a la de hacer una. Eso pertenece a un futuro trabajo sobre disparadores, no al cliente HTTP que existe hoy.',
      },
      videoInformation: {
        title: 'Información de vídeo',
        body: 'Leer los metadatos de un contenedor con honestidad necesita un parser que esta build no tiene. probe-video y probe-audio siguen siendo conversiones declaradas pero sin implementar, en vez de un componente que devuelve suposiciones.',
      },
      nativePlugin: {
        title: 'Una vía de escape a un plugin nativo',
        body: 'No hay ninguna forma de que un tercero llegue al nivel de confianza, en proceso, y no está planeado que la haya. Si alguna vez aparece una, la historia de seguridad que describe esta página desaparece.',
      },
    },
    limitations: {
      eyebrow: 'Limitaciones conocidas',
      title: 'Lo que el modelo no hace',
      lead: 'Dicho sin rodeos, porque una página de seguridad que solo enumera controles es marketing. Esta es la versión actual de docs/SECURITY.md §9 — reproducida aquí con las mismas palabras que usa el documento de referencia.',
      sourceNote: '§9, la versión autorizada y vigente',
      items: {
        noSandbox: {
          strong: 'El sandbox todavía no existe.',
          rest: 'Los componentes de terceros no pueden ejecutarse en absoluto. Un',
          codeKind: 'kind: "wasm"',
          middle: 'nodo falla con',
          codeNoImpl: 'no-implementation',
          suffix: '. Todo lo que se ejecuta hoy es de origen propio y en proceso.',
        },
        nothingSigned: {
          strong: 'Nada está firmado y nada se verifica.',
          rest: 'La firma Ed25519, un registro de contrafirmas y una lista de revocación firmada están especificados y no implementados. No hay ningún registro desde el que instalar.',
        },
        noCeiling: {
          strong: 'Sin timeout, sin techo de fuel ni de memoria por paso.',
          rest: 'La cancelación es una bandera cooperativa. Un componente que hace un bucle sin comprobarla no se detiene.',
        },
        noDenyList: {
          strong: 'El broker no tiene una lista negra de ubicaciones sensibles.',
          rest: 'Comprueba que una petición se queda dentro de una carpeta que concediste; no comprueba si esa carpeta era, para empezar, un sitio que debería haber rechazado. Concede un directorio del sistema y habrás concedido un directorio del sistema.',
        },
        secretsUnresolved: {
          strong: 'Los secretos se declaran y nunca se resuelven.',
          rest: 'Un flujo de trabajo puede marcar una variable como secreta; nada la lee y no hay integración con ningún keystore. Un valor secreto no puede llegar al archivo de proyecto — esa garantía es real y está probada — pero un flujo de trabajo que necesite un token todavía no tiene dónde ponerlo con seguridad.',
        },
        grantsPerRun: {
          strong: 'Los permisos son por ejecución y no se recuerdan.',
          rest: 'No hay ningún registro de lo que se permitió antes, ni distinción entre «permitido una vez» y «permitido siempre».',
        },
        bridgeTrusts: {
          strong: 'El puente de escritorio confía en su propio frontend.',
          rest: 'Esa es la relación de confianza correcta — el WebView es de origen propio — pero significa que un bug de scripting en el editor sería un bug de falsificación de permisos, no solo una desfiguración.',
        },
        noAudit: {
          strong: 'Sin auditoría externa.',
          rest: 'Este modelo lo han revisado quienes lo construyeron y la batería de pruebas automatizadas. Eso no es lo mismo.',
        },
        sideChannels: {
          strong: 'Los canales laterales quedan fuera de alcance.',
          rest: 'Los ataques de ejecución especulativa y de temporización desde un futuro invitado de WebAssembly contra la memoria del host no están defendidos ni analizados.',
        },
      },
    },
    reporting: {
      eyebrow: 'Encontraste algo',
      title: 'Reportar una vulnerabilidad',
      lead: 'Por favor, no abras un issue público para un problema de seguridad. Un reporte público pone en marcha un reloj que quienes pueden arreglarlo quizá no logren ganar.',
      noAddress:
        'Todavía no existe una dirección de seguridad publicada — el dominio en los identificadores de este proyecto no está registrado, así que cualquier dirección que puedas deducir de este sitio no lleva a ningún sitio. Hasta que se publique una, repórtalo mediante el sistema privado de reporte de vulnerabilidades del host del repositorio, o consulta el borrador de divulgación coordinada para ver qué incluir.',
      readDisclosure: 'Leer el borrador de divulgación',
    },
  },

  components: {
    meta: {
      description:
        'Cada componente de esta build — {count} más {triggers} disparadores — con sus puertos reales, su configuración y sus permisos, generado a partir de los manifiestos que analiza el runtime.',
    },
    hero: {
      eyebrow: '{count} componentes + {triggers} disparadores',
      title: 'Cada componente de esta build',
      lead: 'Generado a partir de crates/encastra-builtins/src/*.rs — los manifiestos que el runtime analiza de verdad, no un documento que pueda desviarse de ellos. Nada aquí puede instalar un componente nuevo; todavía no hay marketplace ni registro, así que este es el conjunto completo.',
    },
    jumpToCategory: 'Ir a una categoría',
    inputs: 'Entradas',
    outputs: 'Salidas',
    none: 'Ninguna.',
    configuration: 'Configuración',
    capabilities: 'Permisos',
    declaresNothing:
      'No declara nada. No puede alcanzar el sistema de archivos, la red, el portapapeles ni una notificación.',
    trigger: 'Disparador',
    component: 'componente',
    componentsPlural: 'componentes',
  },

  howItWorks: {
    meta: {
      description:
        'Los seis pasos por los que pasa cada flujo de trabajo de Encastra, desde elegir un componente hasta leer el registro de una ejecución terminada — mostrados con los mismos diagramas que usa el editor, no capturas de pantalla.',
    },
    hero: {
      eyebrow: 'Cómo funciona',
      title: 'Seis pasos, siempre',
      lead: 'Un flujo de trabajo que vigila una carpeta y uno que se ejecuta una vez y se detiene pasan por la misma forma. Nada de lo que sigue es una captura de pantalla — cada diagrama es el mismo lenguaje de nodos y cables que dibuja el editor, construido a partir de los manifiestos reales de los componentes.',
    },
    steps: {
      choose: {
        title: 'Elige',
        leadPrefix:
          'La paleta enumera cada componente disponible para ti — diecinueve, más dos disparadores. Cada uno indica qué hace en una frase, la misma frase en todos los sitios donde aparece: en el bloque, en la paleta y en el',
        leadLinkText: 'catálogo de componentes',
        leadSuffix: '.',
        body: 'Los componentes son deliberadamente estrechos. Un bloque que redimensionara una imagen, la guardara y enviara una notificación sería fácil de usar una vez e imposible de reutilizar. Mantenido estrecho, el mismo bloque Resize Image sirve a un flujo de trabajo de fotos, a uno de miniaturas, y a uno que todavía nadie ha construido.',
      },
      drag: {
        title: 'Arrastra',
        lead: 'Coloca un bloque en el lienzo. Todavía no existe nada del flujo de trabajo salvo este único paso — no tiene conexiones y no se ejecutará por sí solo.',
        body: 'El lienzo es alcanzable enteramente desde el teclado, no solo con el ratón — un bloque que no pudiera seleccionarse sin uno dejaría sus ajustes y su aviso de permiso inalcanzables para quien no pueda usar uno.',
      },
      connect: {
        title: 'Conecta',
        caption: 'examples/json-report, sin conectar a una ejecución',
        lead: 'Traza una línea de una salida a una entrada y el sistema de tipos decide, en el momento, si encaja — antes de que el flujo de trabajo exista, no cuando falla a mitad de una ejecución.',
        body1:
          'El mismo tipo encaja en silencio. Un tipo más estrecho en uno más ancho — una imagen en un archivo — también encaja en silencio. Un tipo más ancho en uno más estrecho es legal pero nunca silencioso: en el cable aparece una conversión visible, porque una afirmación que puede ser falsa necesita un sitio donde fallar. En diagonal — una imagen en un vídeo — se rechaza de plano; ambos son tipos de archivo, y ser hermanos no es una relación que convierta.',
        body2Prefix: 'El grafo de la derecha es',
        body2Suffix:
          ', el mismo que se cita en el README: leer un archivo, analizarlo como JSON, volver a escribirlo y luego notificar. Sus tres conexiones muestran los tres tipos a la vez — un cable del mismo tipo, una conversión explícita y una implícita.',
      },
      permissions: {
        title: 'Configura los permisos',
        caption:
          'Lo que muestra el inspector para Save File — reconstruido a partir de su manifiesto real, no una captura de pantalla, y no un control interactivo en esta página.',
        fallbackReason:
          'Guarda el archivo en la carpeta que elijas. No puede escribir en ningún otro sitio.',
        lead: 'Un paso que necesita alcanzar algo fuera del grafo — una carpeta, una dirección de red, una notificación — pide exactamente eso, con una frase escrita para quien decide, no el nombre del permiso.',
        bodyPrefix: 'Declarar no es que se conceda. Un componente que pide',
        bodySuffix:
          'sigue sin poder escribir nada hasta que alguien pulsa el botón, y el botón permanece deshabilitado hasta que se elige de verdad una carpeta — un permiso concedido sin nada asociado es un permiso sin límites, y la aplicación no ofrece uno así.',
      },
      run: {
        title: 'Ejecuta',
        caption: 'Un rechazo no descarta el trabajo que ya se completó',
        lead: 'Pulsa ejecutar y el estado de cada paso cambia según ocurre — esperando, ejecutando, terminado, fallido, omitido — con el tiempo mostrado mientras todavía es útil verlo.',
        bodyPrefix:
          'Este es el mismo grafo, ejecutado de verdad, sin ninguna carpeta todavía permitida para Save File — la transcripción exacta citada en el README.',
        bodyWriteFile: 'Write File',
        bodyMiddle: 'se rechaza, y',
        bodyNotify: 'Notify',
        bodySuffix:
          'se omite porque el paso del que dependía no terminó. Los dos primeros pasos aun así se completaron; una ejecución con un rechazo se reporta como parcialmente terminada, no como un fallo.',
      },
      inspect: {
        title: 'Inspecciona',
        journal: {
          state: 'Estado',
          stateValue: 'fallido · 0ms',
          input: 'Entrada',
          inputValue: 'content: text (62 caracteres)',
          capability: 'Permiso',
          capabilityRefused: 'rechazado',
          reason: 'Motivo',
          reasonValue: 'no se ha permitido ninguna carpeta para este nodo',
        },
        lead: 'Selecciona el paso fallido y el inspector muestra el registro: qué entró, qué salió, cuánto tardó, y cada permiso que vio el broker — permitido o rechazado.',
        body: 'El registro describe valores en vez de citarlos — una longitud, una forma, un número de handle — nunca el contenido de un archivo. Está escrito para poder pegarse en un reporte de bug sin que salgan los datos de nadie con él.',
        sourceNote: 'la versión automatizada de esta comprobación',
      },
    },
    closing: {
      lead: 'Esto es todo lo que hace hoy el producto entero — nada aquí espera a una función que todavía no está construida.',
      buildIt: 'Construye tú mismo el mismo flujo de trabajo',
      download: 'Descarga la beta',
    },
  },

  features: {
    meta: {
      description:
        'Lo que hace la aplicación hoy: un runtime real, un broker de permisos, un lienzo tipado, historial de versiones nativo, y una CLI — todo verificado por pruebas, nada insinuado que no esté construido.',
    },
    hero: {
      eyebrow: 'Funciones',
      title: 'Lo que hace la aplicación hoy',
      lead: 'Cada elemento de abajo es una prueba automatizada o algo que puedes hacer en la paleta ahora mismo. Nada aquí es un punto del roadmap disfrazado de función.',
    },
    built: {
      typedCanvas: {
        title: 'Un lienzo tipado',
        body: 'Coloca componentes, conéctalos, y la conexión se comprueba en el momento contra una única tabla de reglas que leen tanto el editor como el runtime — una conexión ilegal es imposible de dibujar, no solo desaconsejada.',
      },
      realRuntime: {
        title: 'Un runtime real',
        body: 'Validación, planificación topológica, ejecución, y un registro de exactamente lo que hizo cada paso — secuencial por diseño, y el mismo motor detrás de la aplicación de escritorio y de la CLI.',
      },
      broker: {
        title: 'El broker de permisos',
        body: 'El único código que toca la autoridad del sistema operativo, incluso para los componentes que trae el producto. Un rechazo se registra con un motivo; una concesión también se registra.',
      },
      componentCount: {
        title: '{count} componentes + {triggers} disparadores',
        body: 'Archivos, imágenes, datos, control de flujo, la red, el portapapeles del sistema y notificaciones. Pequeño a propósito — mira el catálogo completo.',
      },
      triggers: {
        title: 'Disparadores y sesiones',
        body: 'Vigila una carpeta o ejecútate con un temporizador, y el flujo de trabajo se inicia solo por cada evento en vez de esperar a que alguien pulse un botón cada vez.',
      },
      versioning: {
        title: 'Historial de versiones nativo del proyecto',
        body: 'Un archivo .encastra es un ZIP determinista con su propio historial de versiones — crear, restaurar, comparar — sin ninguna base de datos externa.',
      },
      cli: {
        title: 'Una CLI',
        body: 'El mismo runtime, sin interfaz gráfica, con todo el modelo de permisos expresable como flags — encastra run --allow-write step=./folder no es una simplificación de la aplicación de escritorio, es el mismo motor.',
      },
      imageProcessing: {
        title: 'Procesamiento de imágenes, con límites reales',
        body: 'Redimensiona, convierte, genera miniaturas y lee metadatos — con un decodificador que rechaza una imagen que afirme un tamaño imposible antes de reservar nada de memoria.',
      },
    },
    notYet: {
      eyebrow: 'Todavía no',
      title: 'Lo que está diseñado, y lo que es solo eso',
      lead: 'Dicho aquí en vez de dejar que alguien lo descubra al pulsar un enlace muerto — la interfaz nunca debería prometer algo que no existe.',
    },
    sandbox: {
      title: 'Componentes de terceros, en un sandbox de WebAssembly',
      blockedBy: {
        item1: 'Un crate anfitrión que carga un componente definido en WIT sin autoridad ambiente',
        item2: 'Timeouts por nodo, medición de fuel y un techo de memoria',
        item3:
          'Firma y una lista de revocación, para que un componente instalado pueda verificarse',
      },
      bodyPrefix:
        'El diseño está escrito — mira /security — y nada de esto se ejecuta. Todo componente de esta build es de origen propio y en proceso; un manifiesto que declare',
      bodySuffix: 'falla de inmediato con',
    },
    registry: {
      title: 'Un registro, un marketplace, e instalar un componente nuevo',
      blockedBy: {
        item1: 'El sandbox de Wasm de arriba',
        item2: 'Un backend: autenticación, usuarios, proyectos',
        item3: 'Una vía de publicación y revisión',
      },
      bodyPrefix:
        'Nada de lo que usas hoy vino de ningún sitio que no sea la caja en la que llegó. Mira',
      bodyMiddle: 'y',
      bodySuffix: 'para ver lo que esas páginas dicen de sí mismas.',
    },
    cta: 'Ver cada componente en detalle',
  },

  templates: {
    meta: {
      description:
        'Los tres flujos de trabajo que trae la aplicación — Image Processor, File Organiser y Thumbnails. Grafos corrientes, ejecutados en el mismo runtime que cualquier cosa que construyas, con sus carpetas deliberadamente vacías.',
    },
    hero: {
      eyebrow: 'Plantillas',
      title: 'Flujos de trabajo que trae la app',
      lead: 'Tres demos, que además hacen de fixtures de pruebas de extremo a extremo — no capturas de pantalla. Cada una llega con sus carpetas deliberadamente vacías, la misma razón por la que un flujo de trabajo que le envías a otra persona llega sin ningún permiso concedido.',
    },
    imageProcessor: {
      summaryPrefix:
        'Vigila una carpeta. Cada vez que aparece una imagen, hace una copia más pequeña en otra carpeta — la misma comprobación que se cita en el README, y el flujo de trabajo que',
      tutorialLinkText: 'el tutorial',
      summarySuffix: 'construye desde cero.',
      needsWatch: 'Una carpeta que vigilar',
      needsSave: 'Una carpeta donde guardar',
    },
    fileOrganiser: {
      summary:
        'Vigila una carpeta y mueve lo que llega a ella a una de otras tres, según el tipo de archivo. La extensión decide la ruta; el archivo en sí es lo que viaja por ella.',
      needsWatch: 'Una carpeta que vigilar',
      needsImages: 'Una carpeta para imágenes',
      needsDocuments: 'Una carpeta para documentos',
      caption: 'Hay una tercera ruta, para cualquier otra cosa, conectada pero no mostrada aquí',
    },
    thumbnails: {
      summary:
        'Convierte una carpeta de imágenes en vistas previas cuadradas, listas para una galería o una cuadrícula. A diferencia de Image Processor, este procesa los archivos que ya están en la carpeta cuando se inicia.',
      needsWatch: 'Una carpeta que vigilar',
      needsSave: 'Una carpeta donde guardar',
    },
    rule: {
      eyebrow: 'Una regla',
      title: 'Cada plantilla es un grafo corriente',
      lead: 'Nada de estas tres tiene privilegios. Pasan por la misma validación, el mismo broker de permisos y el mismo runtime que un flujo de trabajo que construyas desde un lienzo vacío — que es también la razón por la que son fixtures de prueba honestos y no capturas de pantalla seleccionadas.',
    },
  },

  docs: {
    meta: {
      description:
        'Lo que está escrito, y para quién. El repositorio todavía no es público, así que esta página describe cada documento en vez de alojarlo.',
    },
    hero: {
      eyebrow: 'Documentación',
      title: 'Lo que está escrito',
      lead: 'El material de referencia vive en el repositorio como docs/*.md, junto al código que describe. El repositorio no es público, así que esta página dice qué es cada documento y para quién se escribió, en vez de alojarlo o enlazarlo.',
    },
    forAnyone: { eyebrow: 'Para cualquiera', title: 'Escrito para alguien que no es ingeniero' },
    forEngineers: { eyebrow: 'Para ingenieros', title: 'Material de referencia' },
    audience: {
      engineers: 'ingenieros',
      everyone: 'todos',
    },
    items: {
      architecture: {
        title: 'Arquitectura',
        summary:
          'Cómo está construido el sistema y por qué, incluyendo lo que está diseñado y todavía no construido.',
      },
      security: {
        title: 'Seguridad',
        summary:
          'El informe de implementación: lo que aplica cada control, y en el §9, lo que no. No es una afirmación de que el producto sea seguro.',
      },
      threatModel: {
        title: 'Modelo de amenazas',
        summary:
          'Activos, límites de confianza, STRIDE por límite, y lo que conscientemente queda sin defensa.',
      },
      runtime: {
        title: 'Runtime',
        summary:
          'Validación, planificación, ejecución, el registro, y las conversiones en los cables.',
      },
      componentSdk: {
        title: 'SDK de componentes',
        summary:
          'El contrato que implementaría un componente de terceros. Documenta el contrato, no una vía funcional — el host todavía no existe.',
      },
      projectFormat: {
        title: 'Formato de proyecto',
        summary: 'Qué contiene un archivo .encastra y qué garantías ofrece.',
      },
      release: {
        title: 'Release',
        summary: 'Cómo se produce una build, qué contiene, y qué puedes comprobar sobre ella.',
      },
      testing: {
        title: 'Pruebas',
        summary: 'Qué se prueba, cómo, y cuáles pruebas son las que de verdad sostienen todo.',
      },
      productRoadmap: {
        title: 'Roadmap del producto',
        summary: 'Qué se lanza cuándo, y una lista con nombre de lo que haría que esto fallara.',
      },
      adr: {
        title: 'Registros de decisiones',
        summary: 'Las decisiones, con las alternativas que perdieron.',
      },
    },
    closing: {
      lead: 'El propio tutorial está escrito por completo, no solo descrito — es el único sitio donde este sitio aloja de verdad el contenido en vez de señalarlo.',
      cta: 'Leer el tutorial',
    },
  },

  tutorials: {
    meta: {
      title: 'Construye tu primer flujo de trabajo',
      description:
        'El único tutorial escrito por completo: vigila una carpeta, redimensiona lo que llegue a ella, guarda una copia más pequeña en otro sitio. Los mismos tres bloques que el proyecto usa como su propia prueba de que todo funciona.',
    },
    hero: {
      eyebrow: 'Aprender',
      title: 'Construye tu primer flujo de trabajo',
      lead: 'Un flujo de trabajo que se queda vigilando una carpeta. Cada vez que sueltas una foto en ella, aparece automáticamente una copia más pequeña en otra carpeta. Estos son los mismos tres bloques que el proyecto usa como su propia prueba de que todo funciona — hay una prueba automatizada que mete un PNG real de 800×400 y comprueba que sale un PNG real de 200×100, y si falla se considera que el producto está roto.',
      time: 'Tiempo',
      timeValue: 'Unos diez minutos, la mayoría leyendo',
      needs: 'Necesitas',
      needsValue: 'Encastra instalado, y un archivo de imagen para probar',
    },
    beforeStart: {
      eyebrow: 'Antes de empezar',
      title: 'Crea dos carpetas',
      body: 'Dos carpetas separadas, no una. Si el flujo de trabajo escribiera sus resultados de vuelta en la carpeta que estaba vigilando, el vigilante notaría el resultado y lo procesaría otra vez, y el resultado de eso otra vez. Mantenerlas separadas evita toda esa clase de problema.',
      inbox: { name: 'inbox', body: 'La carpeta en la que soltarás las fotos.' },
      out: { name: 'out', body: 'La carpeta donde aparecerán las copias más pequeñas.' },
    },
    settingsTable: {
      setting: 'Ajuste',
      notes: 'Notas',
      required: '(obligatorio)',
    },
    steps: {
      1: {
        title: 'Un lienzo vacío',
        visualPrefix: 'Abre Encastra. Desde',
        home: 'Inicio',
        visualMiddle1: ', empieza un flujo de trabajo nuevo. Aterrizas en',
        builder: 'Constructor',
        visualMiddle2: ', viendo tres áreas: la',
        palette: 'paleta',
        visualMiddle3: 'a un lado, con la lista de cada bloque disponible para ti; el',
        canvas: 'lienzo',
        visualMiddle4: 'en el medio, vacío por ahora; y el',
        inspector: 'inspector',
        visualSuffix: 'al otro lado, que se rellena cuando seleccionas un bloque.',
        lead: 'Todavía no hay nada en el lienzo. Eso es todo este paso.',
      },
      2: {
        title: 'Añade Watch Folder',
        leadPrefix: 'Busca',
        watchFolder: 'Watch Folder',
        leadSuffix:
          'en la paleta y colócalo en el lienzo, hacia la izquierda. Detecta cuando aparece un archivo en una carpeta e inicia el flujo de trabajo.',
        bodyPrefix: 'Es un',
        trigger: 'disparador',
        bodySuffix:
          ', que es un tipo de bloque distinto del resto: no tiene entradas, porque nada lo alimenta — es lo que empieza. Da tres salidas; para este flujo de trabajo solo necesitas',
        bodyEnd: 'para este flujo de trabajo.',
      },
      3: {
        title: 'Añade Resize Image',
        leadPrefix: 'Coloca',
        resizeImage: 'Resize Image',
        leadSuffix:
          'en el lienzo, a la derecha del vigilante. Cambia el tamaño de una imagen, y nada más — no guarda nada, y el paso 5 explica por qué eso importa.',
      },
      4: {
        title: 'La primera conexión, y qué significa',
        caption: 'watch.file → resize.image — legal, y no silenciosa',
        leadPrefix: 'Arrastra la salida',
        leadMiddle: 'del vigilante hasta la entrada',
        leadSuffix:
          'del redimensionador. Una conexión dice: cuando este paso produzca su resultado, entrégaselo a ese otro — y es la conexión la que decide el orden, porque tú nunca programas nada.',
        body1Prefix: 'El puerto',
        body1Middle: 'del vigilante es de tipo File; el puerto',
        body1Suffix:
          'del redimensionador es de tipo Image. No son el mismo tipo, e Image es el más estrecho de los dos — toda imagen es un archivo, pero no todo archivo es una imagen. Conectar un File con un Image es una afirmación de que ese archivo realmente lo es, y esa afirmación puede ser falsa. Así que la conexión se permite, pero no es silenciosa:',
        body1End:
          'aparece en el cable, una conversión en la que un archivo que resulta ser un documento de texto tiene un sitio visible donde fallar.',
        body2Prefix: 'Lo que viaja por la línea no es una ruta. El redimensionador recibe un',
        handle: 'handle',
        body2Suffix:
          '— un ticket opaco que significa «el archivo que te dieron» — y no puede ver nada más, que es por lo que la pregunta de permisos del paso 6 es lo bastante concreta como para merecer una respuesta.',
      },
      5: {
        title: 'Añade Save File',
        caption: 'watch.file → resize.image → save.file',
        leadPrefix: 'Coloca',
        saveFile: 'Save File',
        leadMiddle: 'a la derecha del redimensionador, y conecta la salida',
        leadEnd: 'del redimensionador con la entrada',
        leadSuffix:
          'de Save File. Esa conexión no necesita conversión — un Image entrando en una entrada File es un',
        widening: 'ensanchamiento',
        leadFinal: ', que nunca puede fallar.',
        bodyPrefix:
          '¿Por qué no guarda el propio redimensionador su resultado? El redimensionador escribe en un espacio de trabajo temporal que pertenece a la ejecución, que no está en ningún sitio que puedas ver y no necesita ningún permiso tuyo. Poner un archivo en un sitio que',
        can: 'sí',
        bodySuffix:
          'puedes ver es un acto distinto, y es el acto que tiene que pedir permiso — así que Save File es el único bloque que lo hace, y siempre sabes qué paso toca tu disco.',
      },
      6: {
        title: 'Permisos, y por qué se te pregunta',
        watchReason: 'Vigila la carpeta que elijas y lee los archivos que aparecen en ella.',
        saveReason:
          'Guarda el archivo en la carpeta que elijas. No puede escribir en ningún otro sitio.',
        leadPrefix:
          'Selecciona Watch Folder otra vez y mira el inspector: debajo de sus ajustes hay una sección',
        permissionsSection: 'Permisos',
        leadMiddle: '. Selecciona Save File y encuentras la suya propia. Pulsa',
        allowThisFolder: 'Permitir esta carpeta',
        leadSuffix: 'en ambos.',
        body1:
          'Lo que acabas de aceptar no es «este flujo de trabajo puede leer y escribir archivos». Aceptaste que este vigilante puede leer dentro de esa carpeta, y que este bloque Save File puede escribir dentro de esa otra carpeta — nada fuera de ella, y un segundo bloque Save File sería una segunda decisión, separada.',
        body2Prefix: 'Fíjate en lo que Resize Image',
        not: 'no',
        body2Suffix:
          'está pidiendo: nada. Solo ve lo que el flujo de trabajo le entregó, que no es una decisión, porque tú ya lo dijiste al dibujar la línea.',
        callout:
          'Estos permisos duran una sola ejecución. No se guardan en el archivo ni se recuerdan entre ejecuciones — si le envías este flujo de trabajo a alguien, le llega sin poder hacer nada hasta que esa persona responda por sí misma.',
      },
      7: {
        title: 'Ejecútalo',
        visual1Prefix: 'Fíjate en que el botón no dice',
        run: 'Ejecutar',
        visual1Middle: '. Dice',
        startWatching: 'Empezar a vigilar',
        visual1Suffix:
          ', porque este flujo de trabajo empieza con un disparador: espera, en vez de hacer algo una vez y detenerse. Un punto en la barra de herramientas y un contador en la barra de estado te dicen que está en marcha.',
        visual2Prefix: 'Suelta una foto en',
        visual2Suffix:
          '. En un segundo más o menos los tres bloques se iluminan uno tras otro, aparece una copia más pequeña en',
        visual2End:
          ', y la barra de estado cuenta una ejecución. Cada archivo es su propia ejecución — suelta tres más y observa cómo pasa tres veces más.',
        leadPrefix: 'Pulsa',
        ctrl: 'Ctrl',
        leadMiddle: '+',
        enter: 'Intro',
        leadSuffix: ', o el botón de la barra de herramientas.',
        body: 'Hay una pequeña pausa antes de que pase nada, a propósito: el vigilante comprueba la carpeta unas dos veces por segundo, y luego espera hasta que el archivo deja de cambiar de tamaño antes de entregarlo. Una foto grande copiada desde una unidad de red sigue creciendo unos segundos después de aparecer, y entregársela al redimensionador en ese momento fallaría de una forma que parecería culpa de tu flujo de trabajo.',
      },
      8: {
        title: 'Mira lo que pasó',
        cardTitle: 'Resize Image',
        cardLine1: 'terminado · 38ms',
        cardLine2: 'image: 800×400 in → image: 200×100 out',
        cardLine3: 'fs.read — permitido (input-handles)',
        leadPrefix: 'Cuando se detiene, el inspector muestra el',
        journal: 'registro',
        leadSuffix:
          '— el historial de la ejecución. Selecciona el redimensionador y ves en qué estado terminó, cuánto tardó, y cada solicitud de permiso que vio la puerta, permitida o rechazada.',
        body: 'El registro describe valores en vez de citarlos — nunca el contenido de tus fotografías. En esta build nada se escribe en disco; cierra la aplicación y este registro desaparece.',
      },
      9: {
        title: 'Guárdalo',
        visualPrefix: 'Consigues un único archivo',
        visualSuffix:
          'con el grafo, los ajustes de cada bloque, y un historial de versiones por el que puedes navegar y desde el que puedes restaurar. No guarda tus permisos, y no puede guardar un secreto — el sitio que guardaría uno no existe en el formato.',
        lead: 'Un solo archivo. Puedes enviarlo por correo, subirlo a un repositorio, o renombrarlo — nada en él depende de la máquina que lo escribió.',
      },
    },
    refusal: {
      eyebrow: 'Cuando se niega a ejecutarse',
      title: 'Así es como funciona el sistema',
      body1:
        'Si ejecutas antes de conceder un permiso, o cambias una carpeta después de modo que el permiso concedido ya no coincida:',
      transcript:
        'denied: This component tried to use fs.write and was not allowed: no folder has\nbeen allowed for this node.\nGrant this component access to a folder, then run again.',
      body2:
        'Selecciona el paso, revisa la sección de permisos, pulsa el botón de nuevo. El resto del flujo de trabajo se siguió ejecutando — los pasos que dependían del rechazado se marcan como omitidos, con el motivo.',
    },
    tryBreaking: {
      eyebrow: 'Intenta romperlo',
      title: 'Qué cambiar a continuación',
      swapResizer: {
        title: 'Cambia el redimensionador',
        body: 'Sustituye Resize Image por Thumbnail para obtener vistas previas cuadradas en vez de una copia escalada.',
      },
      addNotification: {
        title: 'Añade una notificación',
        body: 'Pon Notify después de Save File. Necesita su propio permiso — un Allow simple, ya que no hay nada que acotar sobre una notificación.',
      },
      forceFormat: {
        title: 'Fuerza un formato',
        body: 'Pon Convert Image entre el redimensionador y Save File para escribir todo como WebP.',
      },
      removePermission: {
        title: 'Quita un permiso',
        body: 'Ejecútalo de nuevo con una carpeta sin conceder, solo para ver cómo se niega correctamente.',
      },
    },
    closing: {
      lead: 'Junto al que acabas de construir se incluyen dos flujos de trabajo de demostración: File Organiser y Thumbnails, ambos con sus carpetas deliberadamente vacías.',
      templates: 'Ver las plantillas incluidas',
      download: 'Descarga la beta',
    },
  },

  pricing: {
    meta: {
      description:
        'Lo que cuesta hoy: nada. No hay planes de pago, ni cuentas, ni sistema de pago en esta build.',
    },
    hero: {
      eyebrow: 'Precios',
      title: 'Lo que cuesta hoy',
      lead: 'Nada. No hay sistema de pago, ni cuenta, ni plan entre el que elegir — así que en esta página hay un único precio real y una ausencia declarada, en vez de una tabla de precios con números inventados.',
    },
    free: {
      badge: 'Gratis — beta',
      title: 'Descárgalo y ejecútalo',
      body: 'El instalador de Windows no cuesta nada y no necesita cuenta. Todo lo documentado en este sitio — el runtime, el broker de permisos, los diecinueve componentes — está disponible hoy en la beta, con las limitaciones indicadas en /security.',
      cta: 'Descarga la beta',
    },
    notYet: {
      eyebrow: 'Todavía no',
      title: 'Lo que eventualmente costaría dinero',
      lead: 'Los pagos reales quedan explícitamente fuera de alcance para el hito actual, y el roadmap los sitúa después de que exista un modelo de listado de marketplace — un listado no es lo mismo que el dinero moviéndose a través de él.',
    },
    payments: {
      title: 'Sin planes de pago, sin compras en el marketplace, sin suscripciones',
      blockedBy: {
        item1: 'Un backend con cuentas y facturación',
        item2: 'Un modelo de listado de marketplace (construido primero sin pagos)',
        item3: 'Pagos reales, mantenidos en sandbox hasta que eso se desactive deliberadamente',
      },
      body: 'Cuando exista algo de esto, sustituirá la afirmación de esta página de «nada que pagar» por números reales — no al revés.',
    },
  },

  about: {
    meta: {
      description:
        'Qué es Encastra, de dónde viene el nombre, su situación legal sin resolver, y dónde está de verdad el proyecto hoy.',
    },
    hero: {
      eyebrow: 'Acerca de',
      title: 'Qué es esto, y dónde está',
      lead: 'Encastra es un runtime local-first que ejecuta un grafo tipado de componentes, más el editor, el protocolo y la CLI construidos alrededor. Esta página es la versión honesta de esa frase — qué existe, qué es un nombre provisional, y qué sigue siendo solo un documento de diseño.',
    },
    checkpoint: {
      title: 'La comprobación con la que se mide el producto',
      lead: 'No es una diapositiva. Una prueba en el repositorio, que se ejecuta en cada cambio:',
      body: 'Vigila una carpeta. Suelta un PNG de 800×400 en ella. Aparece una copia de 200×100 en otra carpeta, y no se escribió nada en ningún sitio que no estuviera explícitamente permitido.',
      bodyPrefix: 'Eso es',
      tutorialLinkText: 'el tutorial',
      bodyMiddle: ', y es también el flujo de trabajo que',
      bodySuffix: 'construye a mano y que el terminal de la portada reproduce.',
    },
    name: {
      eyebrow: 'El nombre',
      title: 'Encastra es un nombre provisional',
      body1Prefix: 'Encastrar',
      body1Middle: 'es un verbo español real, del latín',
      body1LatinWord: 'incastrare',
      body1Suffix:
        ': encajar o acoplar dos piezas de modo que cada una sostenga a la otra — el producto, dicho en una palabra. Se eligió de una lista investigada: el scope de npm, la organización de GitHub y el dominio',
      body1Dev: '.dev',
      body1End:
        'aparecen todos sin registrar, y no surgió ningún producto o empresa con este nombre al buscar en ningún sector.',
      body2Strong: 'Lo que no se comprobó, y sí importa: los registros de marcas.',
      body2Prefix:
        'No se han consultado USPTO, EUIPO ni TMview. Que un handle de npm esté disponible no es una autorización de marca, y nadie relacionado con este proyecto afirma que el nombre esté legalmente libre — mira',
      body2LinkText: 'el aviso de marca',
      body2Suffix: 'para la versión completa, e igual de honesta, de este párrafo.',
      body3:
        'El producto se desarrolló originalmente con un nombre provisional distinto que hacía referencia a un conocido juguete de piezas de construcción encajables. Ese nombre creaba un riesgo real de marca y se ha retirado permanentemente de cualquier superficie pública — no aparece en este sitio, en el repositorio, ni en ningún nombre de paquete, y no volverá a aparecer.',
      calloutTitle: 'Hasta que se resuelva',
      calloutBody:
        'El nombre se trata como reversible. Aparece en exactamente tres formas en todo el código — el scope de npm, el prefijo de los crates, y la extensión del archivo de proyecto — precisamente para que un cambio de nombre, si alguna vez hace falta, sea un solo commit con script, no una migración.',
    },
    nonGoals: {
      eyebrow: 'No-objetivos',
      title: 'Lo que esto deliberadamente no es',
      noAiStrong: 'Sin IA en el runtime.',
      noAiBody:
        'Los flujos de trabajo se ejecutan sin ningún modelo en el bucle, por diseño — ningún componente, ninguna decisión de planificación, ni ninguna vía de validación llama a uno. Una ayuda de autoría que sugiera un componente o explique un error es una posible adición futura, estrictamente fuera de la vía de ejecución; no es un plan para volver probabilístico el propio runtime.',
      noFinishedStrong: 'Sin afirmar que esté terminado.',
      noFinishedBody:
        'El runtime, el sistema de tipos, el broker de permisos y el formato de proyecto están construidos y probados. El sitio web que estás leyendo, el flujo de incorporación y las correcciones de accesibilidad son lo que añade la release actual sobre eso — mira /download para ver exactamente qué build es cuál.',
    },
    stands: {
      eyebrow: 'Dónde está',
      title: 'Beta, y lo dice en serio',
      engine: {
        title: 'El motor',
        body: 'Runtime, sistema de tipos, broker de permisos, formato de proyecto, CLI: construidos, probados, y verificados de forma cruzada entre los lectores de TypeScript y de Rust de la misma tabla de reglas.',
      },
      desktop: {
        title: 'La aplicación de escritorio',
        body: 'Un lienzo, una paleta, un inspector que también hace de depurador, e historial de versiones nativo. Probado en Windows; los componentes declaran soporte para macOS y Linux para los que el motor todavía no trae una build.',
      },
      website: {
        title: 'Este sitio web',
        bodyPrefix:
          'Nuevo. Todo su propósito es hacer legible lo anterior para alguien que no ha leído el código fuente — mira el propio relato de docs/BETA-0.2-AUDIT.md sobre por qué no existía antes.',
      },
      everythingElse: {
        title: 'Todo lo demás',
        body: 'Los componentes de terceros, un registro, un marketplace, las cuentas y los pagos están diseñados y no construidos. /security y /marketplace lo dicen específicamente, no solo aquí.',
      },
    },
    closing: {
      lead: 'La build {commit} es la que documenta la página de descarga de este sitio.',
      cta: 'Ver el registro real de la build',
    },
  },

  community: {
    ctaEcosystem: 'De qué formaría parte',
    meta: {
      description:
        'Todavía no está construido. No hay ninguna función de comunidad en esta build — sin cuentas, sin perfiles, sin foro.',
    },
    hero: { eyebrow: 'Comunidad', title: 'Todavía no está construido' },
    notBuilt: {
      title: 'Sin cuentas, sin perfiles, sin foro',
      blockedBy: {
        item1: 'Un backend: autenticación, usuarios, proyectos',
        item2: 'Un registro de componentes donde publicar',
        item3: 'Un modelo de listado de marketplace',
      },
      body1:
        'No hay ningún sitio en esta web ni en la aplicación para iniciar sesión, seguir a otro autor, o publicar nada. Esta página existe para que la barra lateral y el mapa del sitio sean honestos sobre lo que no existe, en vez de apuntar a una pantalla vacía.',
      body2Prefix:
        'El roadmap del producto sitúa Community después del backend y el registro de componentes — mira',
      body2LinkText: '/about',
      body2Suffix: 'para ver la etapa actual del proyecto.',
    },
    cta: 'Descarga la beta en su lugar',
  },

  contact: {
    meta: {
      description:
        'Cómo contactar con el proyecto hoy. Todavía no hay correo público, ni cuentas, ni mesa de soporte — esta página dice exactamente qué existe y qué no.',
    },
    hero: {
      eyebrow: 'Contacto',
      title: 'Cómo contactar con el proyecto',
      lead: 'Con honestidad: todavía no hay mucho aquí. Sin cuenta, sin mesa de soporte, y sin ninguna dirección general publicada — porque nada de eso existe. Esta página nombra el único canal que sí existe.',
    },
    noAddress: {
      title: 'Todavía sin dirección de contacto general',
      bodyPrefix: 'El dominio en los propios identificadores de este proyecto,',
      bodyMiddle: 'no está registrado (mira',
      bodySuffix:
        '), así que cualquier dirección que alguien pudiera adivinar en este sitio no llevaría a ningún sitio. Establecer una es un requisito previo al lanzamiento, no algo que se salte por accidente.',
    },
    security: {
      eyebrow: 'Seguridad',
      title: '¿Encontraste una vulnerabilidad?',
      body: 'Este es el único canal especificado hoy. Por favor, no abras un issue público — repórtalo en privado mediante el sistema de reporte privado de vulnerabilidades del host del repositorio. Mira el borrador de divulgación para ver exactamente qué incluir y qué esperar.',
      cta: 'Leer la política de divulgación',
    },
    everythingElse: {
      eyebrow: 'Todo lo demás',
      title: 'Bugs, preguntas y feedback',
      body: 'Todavía no hay mesa de soporte ni un canal de feedback dedicado. Si has encontrado este sitio, lo más probable es que también tengas acceso al repositorio que describe — el historial de commits y su rastreador de issues, donde existan, son lo más parecido a un canal de contacto que tiene este proyecto ahora mismo.',
    },
  },

  ecosystem: {
    meta: {
      description:
        'En qué quiere convertirse Encastra: construir, publicar, descubrir, reutilizar. Qué existe hoy, qué solo está diseñado y en qué orden tiene que ocurrir lo demás.',
    },
    hero: {
      eyebrow: 'Ecosistema',
      title: 'Constrúyelo, publícalo y algún día dáselo a alguien',
      lead: 'Encastra construye software con componentes. Todo lo que se deriva de eso — publicar lo que has hecho, encontrar lo que han hecho otros, instalarlo sin fiarte de nadie — está casi todo diseñado y sin construir. Esta página dice qué es cada cosa.',
    },
    loop: {
      eyebrow: 'El ciclo',
      title: 'Cinco momentos, de los cuales funcionan dos',
      lead: 'Cada uno lleva el estado en el que está de verdad, leído de la misma tabla que lee el resto del sitio.',
      build: {
        title: 'Construir',
        body: 'Coloca componentes, conéctalos y ejecútalos. El editor rechaza una conexión que el motor rechazaría, así que un flujo de trabajo que se dibuja es un flujo de trabajo que se ejecuta.',
      },
      publish: {
        title: 'Publicar',
        body: 'La aplicación lee tu proyecto guardado como lo leería quien lo recibe, lo rechaza si lleva un secreto o nombra tu carpeta personal, y lo escribe en una carpeta junto al documento que lo acompañaría. No se sube nada: no hay adónde subirlo.',
      },
      discover: {
        title: 'Descubrir',
        body: 'No hay registro, así que no hay nada que buscar, nada que ordenar y nadie a quien seguir. Esta página no va a mostrar un catálogo de cosas que no existen.',
      },
      install: {
        title: 'Instalar',
        body: 'No se puede instalar nada desde fuera de la aplicación. Un componente de otra persona necesitaría el sandbox que está diseñado y sin construir; un proyecto de otra persona necesita un registro del que venir y una firma contra la que comprobarse.',
      },
      reuse: {
        title: 'Reutilizar',
        body: 'Un archivo de proyecto ya es portátil, ya lleva su propio historial de versiones y ya fija por contenido cada componente que usa. Quien te pase uno, por el medio que sea, te pasa algo que puedes abrir y cambiar.',
      },
    },
    today: {
      eyebrow: 'Lo que existe',
      title: 'La parte de publicar que no necesita servidor',
      lead: 'Preparar una publicación ocurre entera en tu equipo, y casi todo lo que hace es rechazar.',
      body: 'Un proyecto que era privado se revisa antes de poder entregárselo a un desconocido. La publicación se rechaza cuando:',
      refuses: {
        secret:
          'Un ajuste contiene algo que parece una clave, un token o una clave privada: todo lo que se escribe en un ajuste se guarda en el archivo, y el archivo es lo que se entrega.',
        path: 'Un ajuste apunta dentro de una carpeta personal, lo que nombra a quien lo hizo y no existe en ningún otro equipo.',
        unknown:
          'Usa un componente que esta versión no sabe leer, así que lo que pediría no se puede declarar — y un permiso que nadie puede leer es uno que nadie puede conceder.',
        changed: 'Un componente ya no coincide con el contenido por el que el proyecto lo fijó.',
        licence:
          'Lleva una parte con una licencia que entra en conflicto con aquella bajo la que se publica.',
      },
      folder:
        'Lo que sale es una carpeta con el proyecto y un documento que lo describe: quién lo ofrece, bajo qué nombre y licencia, su hash de contenido y su tamaño, y todos los permisos que pedirá — recogidos de los componentes y no escritos por el autor, porque nadie declara sus propios permisos de memoria con exactitud.',
      notAnAudit: {
        title: 'Esto no es una auditoría',
        body: 'Encuentra los errores lo bastante mecánicos como para encontrarlos. No se ha hecho ninguna revisión de seguridad externa, y que una comprobación pase no es afirmar que algo sea seguro.',
      },
    },
    registry: {
      eyebrow: 'Lo que está diseñado',
      title: 'Qué tendría que garantizar un registro',
      lead: 'Nada de esto está construido. Está escrito para que quien lo construya tenga contra qué construir, y para que los atajos se vean como atajos.',
      guarantees: {
        immutable:
          'Una versión, una vez publicada, no cambia nunca. Se puede retirar; no se puede reescribir por debajo de quien ya la instaló.',
        disclosure:
          'Todos los permisos que pide una publicación se muestran antes de instalar, nunca después.',
        namespace:
          'Un nombre vive dentro del espacio de nombres del propio editor, y la identidad de un editor la comprueba alguien en lugar de afirmarla quien la escribió.',
        noScripts:
          'No se ejecuta nada al instalar. Sin scripts de post-instalación, nunca: es la característica más explotada de todos los ecosistemas de paquetes que la tienen.',
        verified:
          'El contenido se verifica contra su hash y su firma al instalarlo y otra vez cada vez que se carga, y una versión revocada se rechaza en lugar de advertirse.',
      },
    },
    order: {
      eyebrow: 'El orden',
      title: 'Siete cosas, en esta secuencia',
      lead: 'Este orden no es una preferencia. Cada paso es lo que hace que el siguiente signifique algo.',
      steps: {
        review: 'Una revisión de seguridad externa del broker de capacidades.',
        sandbox:
          'El sandbox para código de terceros, con sus límites de tiempo, memoria y combustible realmente aplicados.',
        signing: 'Firma, tanto de la aplicación como de lo que se publique.',
        licence: 'Una decisión de licencia para el código fuente, que hoy no tiene ninguna.',
        registry: 'El registro, con versiones inmutables y permisos declarados antes de instalar.',
        legal: 'Una revisión legal de los términos que aceptarían un marketplace y sus creadores.',
        money: 'El dinero, al final.',
      },
      why: 'Llegar antes al último saltándose cualquiera de los dos primeros haría falsas, de golpe, todas las afirmaciones de seguridad de este producto.',
    },
    money: {
      eyebrow: 'Dinero',
      title: 'Modelado, y sin moverse',
      lead: 'No hay proveedor de pagos, ni cuenta a la que cobrar, ni saldo que liquidar.',
      body: 'Lo que existe es la aritmética y los estados: unidades menores enteras sin ningún decimal en coma flotante cerca, un reparto cuyas dos partes suman lo pagado en cualquier importe, compras que no resucitan tras un reembolso, y derechos de uso que un cliente nunca puede afirmar sobre sí mismo. No hay ninguna comisión escrita, porque nadie ha decidido una y un número en un archivo de código tiende a convertirse en una promesa.',
      rule: 'Una regla se mantiene pase lo que pase: el dinero compra distribución, no permisos. Una publicación de pago la revisa exactamente el mismo código que revisa una gratuita, y la petición de permiso se ve igual tanto si algo fue gratis como si fue caro.',
    },
    cta: {
      download: 'Descargar Encastra',
      components: 'Ver con qué viene',
    },
  },

  marketplace: {
    ctaEcosystem: 'De qué formaría parte',
    meta: {
      description:
        'Todavía no está construido. No hay forma de instalar un componente más allá de los diecinueve que trae la app.',
    },
    hero: { eyebrow: 'Marketplace', title: 'Todavía no está construido' },
    notBuilt: {
      title: 'No puedes instalar un componente',
      blockedBy: {
        item1: 'El sandbox de WebAssembly donde se ejecutarían los componentes de terceros',
        item2:
          'Firma y una lista de revocación, para que un componente instalado pueda verificarse',
        item3: 'Un registro: publicar, verificar, instalar, revocar',
        item4:
          'Un modelo de listado — el movimiento de dinero queda explícitamente fuera de alcance incluso después de eso',
      },
      body1Prefix:
        'Cada componente que puedes usar está en la caja — diecinueve, más dos disparadores, todos de origen propio y compilados en la aplicación. Mira',
      body1LinkText: 'el catálogo completo',
      body1Suffix: 'para ver exactamente qué puede hacer ese conjunto.',
      body2:
        'Cuando esto exista, los listados llegarán antes de que se mueva ningún dinero por ellos — el roadmap trata el modelo de listado del marketplace y los pagos reales como hitos separados, en ese orden.',
    },
    cta: 'Ver lo que de verdad tienes hoy',
  },

  legal: {
    index: {
      meta: {
        description:
          'Los nueve documentos legales que ha redactado este proyecto. Los nueve son borradores pendientes de revisión por un asesor legal cualificado y no son asesoramiento legal.',
      },
      hero: {
        eyebrow: 'Legal',
        title: 'Todos los documentos',
        lead: 'Cada documento de abajo es un borrador. Ninguno ha sido revisado por un abogado, y cada página lo vuelve a decir antes del propio texto.',
      },
      calloutTitle: 'No es asesoramiento legal',
      calloutBody:
        'Estos son borradores de trabajo escritos para declarar, con honestidad, lo que este proyecto pretende prometer actualmente — no políticas terminadas. Nada en esta página ni en las páginas que enlaza debe tomarse como asesoramiento legal, y nada aquí ha sido revisado por un asesor legal cualificado.',
    },
    doc: {
      eyebrow: 'Legal · Borrador',
      metaDescription: 'Borrador — {summary}',
      calloutTitle: 'Borrador — no es asesoramiento legal',
      calloutBodyPrefix:
        'Este documento no ha sido revisado por un asesor legal cualificado y no es una política terminada. Declara, con honestidad, lo que el proyecto pretende prometer actualmente. Mira',
      calloutLinkText: 'todos los documentos',
      calloutBodySuffix: 'para ver el mismo aviso en cada uno de ellos.',
    },
  },
};

export default es;
