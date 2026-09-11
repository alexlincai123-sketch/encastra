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
    planned: 'Próximamente',
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
    closing: {
      eyebrow: 'Beta {version}',
      title: 'Solo Windows, sin firmar, y sincero sobre ambas cosas',
      lead: 'SmartScreen avisará de un editor no reconocido. El aviso es acertado — nada en el archivo demuestra quién lo construyó. El SHA-256 publicado es lo que tienes en su lugar.',
      downloadAndVerify: 'Descargar y verificar',
      readSecurityModel: 'Leer el modelo de seguridad',
      browseComponents: 'Explorar todos los componentes',
    },
  },
};

export default es;
