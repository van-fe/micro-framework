---
title: Fulfillment operations live demo
description: Explore a working host with Vanilla, React, Vue 3, and Vue 2 applications directly in the documentation.
outline: false
sidebar: false
aside: false
---

<script setup lang="ts">
import DemoPreview from "../../.vitepress/theme/DemoPreview.vue";
</script>

# Fulfillment operations live demo

This workspace models daily e-commerce fulfillment operations. The host owns navigation, market filters, and core metrics. Four independent applications handle orders, revenue analytics, customer risk, and legacy operations. Each owns its iframe Realm, module graph, and ShadowRoot while sharing a coherent product experience.

The English documentation starts the demo in English. The language selector in the host header switches Chinese/English and updates every application through lifecycle props. React uses Ant Design, Vue 3 uses Element Plus, and Vue 2 uses Element UI.

All four applications have working dialogs. Default overlays cover the host viewport while their DOM and styles remain in the owning ShadowRoot. Explicit containers opt into local positioning. Try React Portal, Vue Teleport, Element UI append-to-body, and native dialog behavior below.

<DemoPreview />

::: tip Run locally
Run `bun run dev` from the repository root. Documentation uses port 5178; the host and four applications use 5173–5176 and 5179.
:::

The online demo deploys alongside the docs in playground and does not depend on a development server on your computer. Use the link above for a standalone window.

## What the scenario verifies

| Business area | Application | Entry | Observable behavior |
| --- | --- | --- | --- |
| Navigation, market, and period filters | Host shell | Vite host | Composition and cross-application props |
| Priority order queue | Fulfillment | Vanilla + HTML Entry | Templates, native dialog, event cleanup |
| Revenue and fulfillment signals | Commerce intelligence | React 19 + HTML/ESM | Independent modules, Ant Design Modal, Portal |
| Customer risk | Customer success | Vue 3 + HTML/ESM | Element Plus Dialog/Drawer, Teleport |
| Legacy operations | Legacy operations | Vue 2 + HTML/ESM | Element UI Dialog, append-to-body, incremental migration |

Runtime isolation status shows the mounted application count. Inspect a micro-app-host in browser developer tools: visible nodes are in its ShadowRoot and an adjacent hidden iframe supplies the independent JavaScript Realm.

## Deploy elsewhere

Build the complete documentation, host, and four applications and test the same project subpath as Pages:

```bash
DOCS_BASE=/micro-framework/ bun run docs:build:site
bun run test:pages
```

The static output is packages/docs/.vitepress/dist. Production HTML entries load built ESM and styles; JavaScript still executes in separate Realms. Host, bootstrap, shared modules, and application assets all use the deployment subpath. Local development can retain direct source ESM entries.

Override the demo host when it is deployed separately:

```bash
VITE_MICRO_FRAME_DEMO_URL=https://demo.example.com/ bun run docs:build
```

The complete site build embeds its own demo by default. Plain docs:build without a configured demo shows local instructions. Development docs point to port 5173. Chinese and English demo pages share one built application and select the initial locale with a query parameter.
