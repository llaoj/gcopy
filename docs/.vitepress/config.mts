import { defineConfig } from "vitepress";

const base = process.env.DOCS_BASE || "/";

export default defineConfig({
  base,
  title: "GCopy",
  description:
    "Cross-platform clipboard synchronization for Text, Screenshot, and Files — powered by a single Go binary.",
  srcExclude: ["**/README.md"],
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: `${base}favicon.ico` }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "GCopy Documentation" }],
  ],

  themeConfig: {
    logo: "/gcopy.svg",
    socialLinks: [
      { icon: "github", link: "https://github.com/llaoj/gcopy" },
      { icon: "discord", link: "https://discord.gg/pyTrT3aAaC" },
    ],
    search: {
      provider: "local",
      options: {
        locales: {
          "zh-CN": {
            translations: {
              button: {
                buttonText: "搜索文档",
                buttonAriaLabel: "搜索文档",
              },
              modal: {
                noResultsText: "无法找到相关结果",
                resetButtonTitle: "清除查询条件",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                },
              },
            },
          },
        },
      },
    },
  },

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        nav: [
          { text: "Try Online", link: "https://gcopy.link" },
          { text: "Guide", link: "/guide/getting-started" },
          { text: "Self-Hosting", link: "/deploy-by-docker" },
          { text: "Sponsor", link: "/sponsor" },
        ],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Getting Started", link: "/guide/getting-started" },
              { text: "FAQ & Compatibility", link: "/guide/faq" },
            ],
          },
          {
            text: "Self-Hosting",
            items: [
              { text: "Deploy by Docker", link: "/deploy-by-docker" },
              { text: "Deploy from Source", link: "/deploy-from-source" },
            ],
          },
          {
            text: "Community",
            items: [{ text: "Sponsor", link: "/sponsor" }],
          },
        ],
        editLink: {
          pattern: "https://github.com/llaoj/gcopy/edit/main/docs/:path",
          text: "Edit this page on GitHub",
        },
        footer: {
          message: "Released under the MIT License.",
          copyright: "Copyright © 2023-2026 llaoj",
        },
      },
    },

    "zh-CN": {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh-CN/",
      description: "跨平台剪贴板同步服务，支持文字、截图与多文件，单 Go 二进制零依赖部署。",
      themeConfig: {
        nav: [
          { text: "在线体验", link: "https://gcopy.link" },
          { text: "使用指南", link: "/zh-CN/guide/getting-started" },
          { text: "私有部署", link: "/zh-CN/deploy-by-docker" },
          { text: "支持项目", link: "/zh-CN/sponsor" },
        ],
        sidebar: [
          {
            text: "使用指南",
            items: [
              { text: "快速上手", link: "/zh-CN/guide/getting-started" },
              { text: "常见问题与兼容性", link: "/zh-CN/guide/faq" },
            ],
          },
          {
            text: "私有部署",
            items: [
              { text: "使用 Docker 部署", link: "/zh-CN/deploy-by-docker" },
              { text: "二进制与源码部署", link: "/zh-CN/deploy-from-source" },
            ],
          },
          {
            text: "社区与支持",
            items: [{ text: "支持与交流", link: "/zh-CN/sponsor" }],
          },
        ],
        editLink: {
          pattern: "https://github.com/llaoj/gcopy/edit/main/docs/:path",
          text: "在 GitHub 上编辑此页",
        },
        docFooter: {
          prev: "上一页",
          next: "下一页",
        },
        outline: {
          label: "页面导航",
        },
        lastUpdated: {
          text: "最后更新于",
        },
        footer: {
          message: "基于 MIT 许可发布",
          copyright: "Copyright © 2023-2026 llaoj",
        },
      },
    },
  },
});
