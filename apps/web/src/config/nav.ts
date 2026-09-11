/**
 * Every route on the site, in one list.
 *
 * The header, the footer and the sitemap all read this, so a page cannot exist without being
 * reachable and a link cannot point at a page that was never built.
 *
 * `label` and the group's `title` are the English text and stay as the fallback `dictionaries/
 * en.ts` already provides for every key below; `id` is what `Header.tsx` and `Footer.tsx` use to
 * look up the translated string (`nav.primary.{id}` / `nav.footer.items.{id}`) for a Spanish
 * visitor. Kept as a short id rather than deriving one from `href` because the same route can
 * carry two different labels in two different places — `/tutorials` reads "Learn" in the primary
 * nav and "Tutorials" in the footer — so the id has to name the label, not the page.
 */

export interface NavItem {
  readonly href: string;
  readonly id: string;
  readonly label: string;
  readonly summary: string;
}

export interface NavGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const PRIMARY_NAV: readonly NavItem[] = [
  {
    href: '/features',
    id: 'features',
    label: 'Features',
    summary: 'What the application does today.',
  },
  {
    href: '/how-it-works',
    id: 'howItWorks',
    label: 'How it works',
    summary: 'The six steps, start to finish.',
  },
  {
    href: '/components',
    id: 'components',
    label: 'Components',
    summary: 'Every component in this build.',
  },
  {
    href: '/templates',
    id: 'templates',
    label: 'Templates',
    summary: 'Workflows that ship with the app.',
  },
  { href: '/tutorials', id: 'learn', label: 'Learn', summary: 'Build your first workflow.' },
  { href: '/security', id: 'security', label: 'Security', summary: 'The model, and its limits.' },
];

export const FOOTER_NAV: readonly NavGroup[] = [
  {
    id: 'product',
    title: 'Product',
    items: [
      {
        href: '/features',
        id: 'features',
        label: 'Features',
        summary: 'What the application does today.',
      },
      {
        href: '/how-it-works',
        id: 'howItWorks',
        label: 'How it works',
        summary: 'The six steps, start to finish.',
      },
      {
        href: '/components',
        id: 'components',
        label: 'Components',
        summary: 'Every component in this build.',
      },
      {
        href: '/templates',
        id: 'templates',
        label: 'Templates',
        summary: 'Workflows that ship with the app.',
      },
      { href: '/download', id: 'download', label: 'Download', summary: 'Get the beta.' },
      { href: '/pricing', id: 'pricing', label: 'Pricing', summary: 'What it costs today.' },
    ],
  },
  {
    id: 'learn',
    title: 'Learn',
    items: [
      {
        href: '/tutorials',
        id: 'tutorials',
        label: 'Tutorials',
        summary: 'Build your first workflow.',
      },
      { href: '/docs', id: 'docs', label: 'Documentation', summary: 'The reference material.' },
      {
        href: '/security',
        id: 'security',
        label: 'Security',
        summary: 'The model, and its limits.',
      },
    ],
  },
  {
    id: 'ecosystem',
    title: 'Ecosystem',
    items: [
      { href: '/marketplace', id: 'marketplace', label: 'Marketplace', summary: 'Not built yet.' },
      { href: '/community', id: 'community', label: 'Community', summary: 'Not built yet.' },
      {
        href: '/about',
        id: 'about',
        label: 'About',
        summary: 'What this is and where it stands.',
      },
      { href: '/contact', id: 'contact', label: 'Contact', summary: 'How to reach the project.' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal',
    items: [
      {
        href: '/legal',
        id: 'allDocuments',
        label: 'All documents',
        summary: 'Drafts, pending review.',
      },
      {
        href: '/legal/privacy-policy',
        id: 'privacy',
        label: 'Privacy',
        summary: 'What is collected.',
      },
      {
        href: '/legal/terms-of-service',
        id: 'terms',
        label: 'Terms',
        summary: 'Draft terms of service.',
      },
      {
        href: '/legal/security-disclosure',
        id: 'reportVulnerability',
        label: 'Report a vulnerability',
        summary: 'Coordinated disclosure.',
      },
    ],
  },
];
