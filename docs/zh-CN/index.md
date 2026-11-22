---
layout: home

hero:
  name: "GCopy"
  text: "跨系统剪贴板无缝同步"
  tagline: "在 Windows、macOS、Linux、iOS 与 Android 之间丝滑共享文字、截图和文件 —— 免装客户端、不限局域网。"
  image:
    src: /logo-hero.svg
    alt: GCopy
  actions:
    - theme: brand
      text: 立即在线体验 →
      link: https://gcopy.link
    - theme: alt
      text: 快速上手
      link: /zh-CN/guide/getting-started
    - theme: alt
      text: Docker 私有部署
      link: /zh-CN/deploy-by-docker

features:
  - icon: 📋
    title: 文字、截图与多文件全支持
    details: 支持普通文本、系统截图（兼容微信截图等浏览器特殊剪贴板内容粘贴）以及单文件/多文件自动打包同步。
  - icon: 🌐
    title: 不受局域网隔离限制
    details: 无需像 AirDrop 或 LocalSend 那样要求同 Wi-Fi 组播互通，轻松应对公司内外网隔离、跨网段办公机与移动网络场景。
  - icon: 🛡️
    title: 纯内存瞬时中转
    details: 无数据库、不落盘持久化存储。数据仅暂存于服务端内存中，24 小时无活动自动销毁。
  - icon: ⚡
    title: 单一 Go 二进制极简部署
    details: 前端静态资源通过 go:embed 内嵌至单个 Go 可执行文件，一条 Docker 命令或单个二进制即可启动完整服务。
---
