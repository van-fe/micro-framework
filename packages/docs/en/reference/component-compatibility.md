# Component compatibility matrix

Top-level Playwright tests run actual application entries in independent Realms and ShadowRoots across Chromium, Firefox, and WebKit. Earlier real macOS Safari runs also covered the three UI framework applications (3/3), rather than merely checking host-rendered selectors.

| Category | Version | Verified behavior | Three engines |
| --- | --- | --- | --- |
| React UI | React 19.2.8 + Ant Design 6.6.2 | Portal, Modal, Drawer, Tooltip, menus, explicit containers, positioning, clicks, motion, restored host interaction | Pass |
| Vue 3 UI | Vue 3.5.42 + Element Plus 2.14.5 | Teleport, Dialog/Drawer, Tooltip, menus, explicit containers, positioning, clicks, transitions | Pass |
| Vue 2 UI | Vue 2.7.16 + Element UI 2.15.14 | append-to-body, dialogs, tooltips, menus, singleton runtime, old Popper scroll positioning, exit cleanup | Pass |
| Rich text | Quill 2.0.3 | Snow toolbar, contenteditable, typing, select-all, bold, text-change | Pass |
| Code editor | Monaco 0.56.0 | JSON editing, language Worker diagnostics, automatic layout, scoped styles, disposal | Pass |
| Charts | ECharts 6.1.0 | SVG axes/bars, updates, resize, ownership | Pass |
| Maps | Leaflet 1.9.4 | SVG vectors, popup, zoom, nonanimated pan, ownership | Pass |
| WebGL maps | MapLibre GL 6.6.0 | Self-contained cross-origin Vite Worker, local GeoJSON, canvas, jumpTo, disposal | Pass |
| 3D | Three.js 0.185.1 | Scene graph, shaders, pixel reads, rotation rerender, explicit context release | Pass |
| Browser primitives | Module Worker, WebGL 1, multilingual input | Worker wrapper, structured clone, pixels, Chinese typing, native CompositionEvent, cleanup | Pass |

examples/component-matrix-app and its E2E require host selectors to remain unable to cross the ShadowRoot, application Document queries to find local editors, every library's nodes to stay app-owned, and no iframe/host after disposal.

MapLibre uses maplibre-gl-worker.mjs?worker&url resolved against import.meta.url, producing a self-contained production worker on the app origin and exercising cross-origin worker cleanup.

## Remaining combinations

Coverage applies to the listed versions and behaviors, not the entire ecosystem. Extend for Quill plugins/collaboration/long IME text; Monaco other language workers, LSP, diff/large files/extensions; ECharts canvas/WebGL and high-frequency workloads; external Leaflet tiles/images/plugins; external MapLibre tiles/fonts/images/controls and other complex libraries.

Real Safari coverage of the complete editor/map/WebGL matrix, iOS, physical touch/keyboard devices, OS IME candidate windows, and mobile memory pressure remains separate from the covered UI framework scenarios.

New components need initialization, real interaction, ShadowRoot escape checks, and cleanup in all three engines. Safari-specific events, layout, and system APIs also need real Safari application gates.
