import type { Messages } from '../messages';

/**
 * English. The fallback for every locale, always — see `translate.ts`. Every key any page reads
 * must exist here even if it also exists in `es.ts`, because a missing English key has nowhere
 * left to fall back to.
 */
const en: Messages = {
  a11y: {
    skipToContent: 'Skip to content',
  },

  header: {
    navAriaLabel: 'Main',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    download: 'Download',
  },

  nav: {
    primary: {
      features: 'Features',
      howItWorks: 'How it works',
      components: 'Components',
      templates: 'Templates',
      learn: 'Learn',
      security: 'Security',
    },
    footer: {
      groups: {
        product: 'Product',
        learn: 'Learn',
        ecosystem: 'Ecosystem',
        legal: 'Legal',
      },
      items: {
        features: 'Features',
        howItWorks: 'How it works',
        components: 'Components',
        templates: 'Templates',
        download: 'Download',
        pricing: 'Pricing',
        tutorials: 'Tutorials',
        docs: 'Documentation',
        security: 'Security',
        marketplace: 'Marketplace',
        community: 'Community',
        about: 'About',
        contact: 'Contact',
        allDocuments: 'All documents',
        privacy: 'Privacy',
        terms: 'Terms',
        reportVulnerability: 'Report a vulnerability',
      },
    },
  },

  footer: {
    navAriaLabel: 'Footer',
    versionLine: 'Beta {version} · Windows only · builds are not code-signed',
    legal: {
      // Split into a prefix and the link's own text, rather than one sentence with a `{link}`
      // placeholder — `Footer.tsx` wraps `nameLinkText`/`licenceLinkText` in a real `<Link>`, and
      // two whole, separately-translated fragments read correctly in any word order a
      // translation needs, where flattening a `<Link>` into an interpolated string would not.
      namePrefix:
        'Encastra is a working name. The trademark registers have not been searched, so nothing here claims the name is legally clear —',
      nameLinkText: 'why that is written down',
      licencePrefix:
        'No licence has been chosen for the source. The legal documents on this site are',
      licenceLinkText: 'unreviewed drafts',
    },
  },

  theme: {
    changeTheme: 'Change theme',
    switchTo: 'Switch to {theme} theme',
    light: 'light',
    dark: 'dark',
  },

  language: {
    label: 'Language',
    switchTo: 'Switch to {language}',
  },

  status: {
    built: 'Available',
    preview: 'Preview',
    designed: 'Designed, not built',
    planned: 'Coming soon',
  },

  /** Mirrors `config/site.ts`'s `SITE.tagline` / `SITE.description` — kept here, not there,
      because `site.ts` is facts (a version, a hash, a URL), never copy. See that file's own
      comment. */
  site: {
    tagline: 'Build software by assembling components.',
    description:
      'Encastra is a local-first desktop application that runs a typed graph of components. Pick components, connect them, grant permissions, press run. Everything happens on your machine.',
  },

  home: {
    whatExists: {
      eyebrow: 'What exists today',
      title: 'A working engine, not a mockup',
      lead: 'Every claim in the scenes above is either a shipped test or a component you can open in the palette. What is designed and not built is labelled that way, in the same place, every time.',
      runtime: {
        title: 'Runtime',
        body: 'Validation, scheduling, capability enforcement, and a journal of what ran.',
      },
      capabilityBroker: {
        title: 'Capability broker',
        body: 'The only code that touches OS authority — including for components that ship with the product.',
      },
      projectFormat: {
        title: 'Project format',
        body: 'A deterministic .encastra file: graph, lockfile, variables, version history.',
      },
      thirdParty: {
        title: 'Third-party components',
        body: 'The WebAssembly sandbox is designed and documented. Nothing third-party runs yet.',
      },
    },
    closing: {
      eyebrow: 'Beta {version}',
      title: 'Windows only, not code-signed, and honest about both',
      lead: 'SmartScreen will warn about an unrecognised publisher. That warning is accurate — nothing in the file proves who built it. The published SHA-256 is what you have instead.',
      downloadAndVerify: 'Download and verify',
      readSecurityModel: 'Read the security model',
      browseComponents: 'Browse every component',
    },
  },
};

export default en;
