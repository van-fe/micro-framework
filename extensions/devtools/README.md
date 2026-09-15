# Micro Frame DevTools extension

Load this folder unpacked in Chromium/Chrome/Edge's extensions developer mode. Open the host page's DevTools and select **Micro Frame**. The host must call `exposeRuntimeToDevtools(window, runtime)` before application mounting to expose lifecycle history.

The extension displays each Runtime, same-name application instances, states and recent errors. It refreshes only while the panel is visible. Navigation and reload are handled by the next snapshot. All page strings are rendered with `textContent`.

No background service, content script, host permissions or network connection is needed. The fixed read-only snapshot expression uses the [official inspectedWindow API](https://developer.chrome.com/docs/extensions/reference/api/devtools/inspectedWindow) from the DevTools context. No application entry is executed by the extension.

This is a local unpacked extension. Store signing and publication are separate operations; Firefox and Safari extension packages are not provided.
