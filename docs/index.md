---
layout: home

hero:
  name: "GCopy"
  text: "Sync Your Clipboard Across Any Device"
  tagline: "Share text, screenshots, and files seamlessly across Windows, macOS, Linux, iOS, and Android — no app install, no same-LAN requirement."
  image:
    src: /logo-hero.svg
    alt: GCopy
  actions:
    - theme: brand
      text: Try Online →
      link: https://gcopy.link
    - theme: alt
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: Self-Host with Docker
      link: /deploy-by-docker

features:
  - icon: 📋
    title: Text, Screenshots & Multi-File
    details: Sync plain text, direct clipboard screenshots (including special formats like WeChat images), and single or multiple files (automatically zipped).
  - icon: 🌐
    title: Works Across Isolated Networks
    details: Unlike AirDrop or LocalSend, devices do not need to be on the same Wi-Fi or LAN. Ideal for corporate VLANs, VPNs, and remote machines.
  - icon: 🛡️
    title: Ephemeral In-Memory Privacy
    details: Zero database, zero disk persistence. Data lives strictly in server RAM and automatically expires after 24 hours of inactivity.
  - icon: ⚡
    title: Single Go Binary
    details: Static Next.js frontend embedded into one lightweight Go executable via go:embed. Deploy anywhere in seconds with Docker or a single binary.
---
