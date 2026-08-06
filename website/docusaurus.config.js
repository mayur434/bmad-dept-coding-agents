// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// See https://docusaurus.io/docs/api/docusaurus-config for reference.

import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'BMAD DEPT Code Agent',
  tagline:
    'Five AI agents for Adobe + JVM SDLC — audit, sonar, generate, impact, coverage. Role-adapted, multi-LLM.',
  favicon: 'img/favicon.svg',

  url: 'https://mayur434.github.io',
  baseUrl: '/bmad-dept-coding-agents/',

  organizationName: 'mayur434',
  projectName: 'bmad-dept-coding-agents',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl:
            'https://github.com/mayur434/bmad-dept-coding-agents/edit/main/website/',
          breadcrumbs: true,
          showLastUpdateTime: true,
          showLastUpdateAuthor: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.svg',
      metadata: [
        { name: 'keywords', content: 'bmad, dca, adobe commerce, aem, sonar, code audit, ai coding agents' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@mayur434' },
        { property: 'og:type', content: 'website' },
      ],
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: false,
        },
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'BMAD DEPT Code Agent',
        logo: {
          alt: 'BMAD DEPT Code Agent',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/mayur434/bmad-dept-coding-agents',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/getting-started/install' },
              { label: 'Concepts', to: '/concepts/the-5-agents' },
              { label: 'Agents', to: '/agents/audit' },
              { label: 'Reference', to: '/reference/cli-flags' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub Issues', href: 'https://github.com/mayur434/bmad-dept-coding-agents/issues' },
              { label: 'BMAD Method', href: 'https://github.com/bmadcode/bmad-method' },
              { label: 'Contributing', to: '/contributing/authoring-a-new-skill' },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'Roadmap', to: '/roadmap' },
              { label: 'Changelog', to: '/changelog' },
              { label: 'License (MIT)', href: 'https://github.com/mayur434/bmad-dept-coding-agents/blob/main/LICENSE' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} mayur434 · Built with Docusaurus`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'yaml', 'toml', 'php', 'java'],
      },
    }),
};

export default config;
