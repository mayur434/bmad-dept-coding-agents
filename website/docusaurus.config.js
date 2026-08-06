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
  baseUrl: '/bmad-dept-code-agent/',

  organizationName: 'mayur434',
  projectName: 'bmad-dept-code-agent',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

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
            'https://github.com/mayur434/bmad-dept-code-agent/edit/main/website/',
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
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'BMAD DEPT Code Agent',
        logo: {
          alt: 'BMAD DEPT Code Agent',
          src: 'img/favicon.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/mayur434/bmad-dept-code-agent',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/getting-started/prerequisites' },
              { label: 'Concepts', to: '/concepts/the-5-agents' },
              { label: 'Agents', to: '/agents/audit' },
            ],
          },
          {
            title: 'Project',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/mayur434/bmad-dept-code-agent',
              },
              {
                label: 'Changelog',
                to: '/changelog',
              },
              {
                label: 'Roadmap',
                to: '/roadmap',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} mayur434 · MIT License · <a href="https://github.com/mayur434/bmad-dept-code-agent">bmad-dept-code-agent</a>`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'yaml', 'toml', 'php', 'java'],
      },
    }),
};

export default config;
