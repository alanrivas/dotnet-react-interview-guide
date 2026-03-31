import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Guía de Entrevistas Full Stack .NET + React',
  tagline: 'Prepárate para entrevistas de Junior a Senior',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://dotnet-react-interview-guide.alanrivas.me',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'alanrivas', // Usually your GitHub org/user name.
  projectName: 'dotnet-react-interview-guide', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '🚀 Full Stack Interview Guide',
      logo: {
        alt: 'Interview Guide Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'interviewSidebar',
          position: 'left',
          label: '📚 Guía',
        },
        {
          href: 'https://github.com/alanrivas/dotnet-react-interview-guide',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Niveles',
          items: [
            { label: '🟢 Junior', to: '/docs/junior/dotnet/csharp-fundamentos' },
            { label: '🟡 Semi-Senior', to: '/docs/semi-senior/dotnet/csharp-avanzado' },
            { label: '🔴 Senior', to: '/docs/senior/arquitectura' },
          ],
        },
        {
          title: 'Tecnologías',
          items: [
            { label: '.NET / C#', to: '/docs/junior/dotnet/csharp-fundamentos' },
            { label: 'React', to: '/docs/junior/frontend/react-basico' },
            { label: 'SQL', to: '/docs/junior/bases-datos/sql-basico' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Full Stack .NET + React Interview Guide | <a href="https://github.com/alanrivas/dotnet-react-interview-guide" target="_blank">GitHub</a>`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
