/**
 * Every route on the site, in one list.
 *
 * The header, the footer and the sitemap all read this, so a page cannot exist without being
 * reachable and a link cannot point at a page that was never built.
 */

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly summary: string;
}

export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/features', label: 'Features', summary: 'What the application does today.' },
  { href: '/how-it-works', label: 'How it works', summary: 'The six steps, start to finish.' },
  { href: '/components', label: 'Components', summary: 'Every component in this build.' },
  { href: '/templates', label: 'Templates', summary: 'Workflows that ship with the app.' },
  { href: '/tutorials', label: 'Learn', summary: 'Build your first workflow.' },
  { href: '/security', label: 'Security', summary: 'The model, and its limits.' },
];

export const FOOTER_NAV: readonly NavGroup[] = [
  {
    title: 'Product',
    items: [
      { href: '/features', label: 'Features', summary: 'What the application does today.' },
      { href: '/how-it-works', label: 'How it works', summary: 'The six steps, start to finish.' },
      { href: '/components', label: 'Components', summary: 'Every component in this build.' },
      { href: '/templates', label: 'Templates', summary: 'Workflows that ship with the app.' },
      { href: '/download', label: 'Download', summary: 'Get the beta.' },
      { href: '/pricing', label: 'Pricing', summary: 'What it costs today.' },
    ],
  },
  {
    title: 'Learn',
    items: [
      { href: '/tutorials', label: 'Tutorials', summary: 'Build your first workflow.' },
      { href: '/docs', label: 'Documentation', summary: 'The reference material.' },
      { href: '/security', label: 'Security', summary: 'The model, and its limits.' },
    ],
  },
  {
    title: 'Ecosystem',
    items: [
      { href: '/marketplace', label: 'Marketplace', summary: 'Not built yet.' },
      { href: '/community', label: 'Community', summary: 'Not built yet.' },
      { href: '/about', label: 'About', summary: 'What this is and where it stands.' },
      { href: '/contact', label: 'Contact', summary: 'How to reach the project.' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { href: '/legal', label: 'All documents', summary: 'Drafts, pending review.' },
      { href: '/legal/privacy-policy', label: 'Privacy', summary: 'What is collected.' },
      { href: '/legal/terms-of-service', label: 'Terms', summary: 'Draft terms of service.' },
      {
        href: '/legal/security-disclosure',
        label: 'Report a vulnerability',
        summary: 'Coordinated disclosure.',
      },
    ],
  },
];
