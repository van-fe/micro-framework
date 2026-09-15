import type { AppHandle } from "@micro-framework/contracts";
import type { MicroRuntime } from "@micro-framework/runtime";
import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

declare global {
  interface Window {
    __clipboardControlled__?: boolean;
    __clipboardCase__?: {
      runtime: MicroRuntime; handle?: AppHandle; errors: string[];
      calls: Array<{ host: boolean; focused: boolean; active: boolean; receiver: boolean }>;
      deny: boolean; restore(): void;
    };
  }
}

for (const allowed of [false, true]) {
  test(`W298 forwards clipboard.readText via controlled clipboard ports with real host focus and activation (allowed=${allowed})`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    // Every real clipboard method is replaced before application execution; no system clipboard is accessed.
    await page.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
      const nativeHasFocus = document.hasFocus.bind(document);
      Object.defineProperty(window, "__clipboardNativeHasFocus__", { value: nativeHasFocus });
      const clipboard = {
        async readText() {
          const state = window.top!.__clipboardCase__!;
          state.calls.push({ host: window === window.top, focused: nativeHasFocus(),
            active: navigator.userActivation.isActive, receiver: this === clipboard });
          if (window !== window.top) throw new DOMException("Document is not focused", "NotAllowedError");
          if (state.deny) throw new DOMException("Controlled permission denied", "NotAllowedError");
          return "Controlled clipboard text";
        },
      };
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
      window.__clipboardControlled__ = true;
      Object.defineProperty(window, "__restoreClipboardPort__", { value: () => {
        if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
        else Reflect.deleteProperty(navigator, "clipboard");
      } });
    });
    await page.route("**/batch02-native-clipboard.js", route => route.fulfill({ contentType: "text/javascript", body: `
      if (!window.__clipboardControlled__ || !window.parent.__clipboardControlled__) {
        throw new Error('Controlled clipboard ports are required; refusing any real clipboard access');
      }
      let output;
      async function read() {
        try { output.textContent = await navigator.clipboard.readText(); }
        catch (error) { output.textContent = error.name + ': ' + error.message; }
      }
      export async function mount(props) {
        output = document.createElement('output'); output.setAttribute('aria-label', 'Clipboard result');
        const button = document.createElement('button'); button.textContent = 'Read controlled clipboard';
        button.onclick = read; props.container.append(button, output);
        output.textContent = 'Waiting for user activation';
      }
      export function unmount(props) { props.container.replaceChildren(); }
    ` }));
    await page.goto("/benchmark.html");
    await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
    await page.evaluate(async allowed => {
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false },
        capabilities: { allow: allowed ? ["clipboard.read-text"] : [] } });
      const errors: string[] = [];
      runtime.errors.subscribe(event => errors.push(`${event.phase}: ${String(event.error)}`));
      const slot = document.body.appendChild(document.createElement("div")); slot.id = "clipboard-slot";
      window.__clipboardCase__ = { runtime, errors, calls: [], deny: false,
        restore: Reflect.get(window, "__restoreClipboardPort__") as () => void };
      window.__clipboardCase__.handle = await runtime.mountApp({ name: "native-clipboard", container: slot,
        entry: { type: "module", url: new URL("/batch02-native-clipboard.js", location.href).href } });
    }, allowed);
    try {
      const output = page.getByLabel("Clipboard result");
      await expect(output).toHaveText("Waiting for user activation");
      expect(await page.evaluate(() => window.__clipboardCase__!.calls)).toEqual([]);
      await page.getByRole("button", { name: "Read controlled clipboard" }).click();
      if (allowed) {
        await expect(output).toHaveText("Controlled clipboard text");
        expect(await page.evaluate(() => window.__clipboardCase__!.calls)).toEqual([
          { host: true, focused: true, active: true, receiver: true },
        ]);
        await page.evaluate(() => { window.__clipboardCase__!.deny = true; });
        await page.getByRole("button", { name: "Read controlled clipboard" }).click();
        await expect(output).toHaveText("NotAllowedError: Controlled permission denied");
        const automatic = await page.evaluate(async () => {
          // Playwright evaluate starts with a gesture. Wait for that real activation
          // to expire before checking the broker's automatic-effect restriction.
          await new Promise<void>(resolve => {
            const check = () => navigator.userActivation.isActive ? setTimeout(check, 20) : resolve();
            check();
          });
          const frame = document.querySelector<HTMLIFrameElement>("#clipboard-slot iframe")!;
          const before = window.__clipboardCase__!.calls.length;
          try {
            await frame.contentWindow!.navigator.clipboard.readText();
            return { active: navigator.userActivation.isActive, error: "resolved", hostCalls: -1 };
          } catch (error) {
            return { active: navigator.userActivation.isActive, error: (error as Error).name,
              hostCalls: window.__clipboardCase__!.calls.length - before };
          }
        });
        expect(automatic).toEqual({ active: false, error: "NotAllowedError", hostCalls: 0 });
      } else {
        await expect(output).toContainText("NotAllowedError");
        expect(await page.evaluate(() => window.__clipboardCase__!.calls)).toEqual([]);
      }
      expect(await page.evaluate(() => {
        const iframe = document.querySelector<HTMLIFrameElement>("#clipboard-slot iframe")!;
        return { hidden: iframe.hidden, active: document.activeElement?.tagName,
          iframeNativeFocused: (Reflect.get(iframe.contentWindow!, "__clipboardNativeHasFocus__") as () => boolean)(),
          distinctNavigator: iframe.contentWindow!.navigator !== navigator };
      })).toEqual({ hidden: true, active: "MICRO-APP-HOST", iframeNativeFocused: false, distinctNavigator: true });
    } finally {
      const result = await page.evaluate(async () => {
        const state = window.__clipboardCase__!;
        const frame = document.querySelector<HTMLIFrameElement>("#clipboard-slot iframe")!;
        const clipboard = frame.contentWindow!.navigator.clipboard;
        const retainedRead = clipboard.readText.bind(clipboard);
        await state.runtime.destroy();
        const before = state.calls.length;
        const disposedRead = await retainedRead().then(() => "resolved", (error: Error) => error.name);
        const remaining = document.querySelectorAll("#clipboard-slot micro-app-host, #clipboard-slot iframe").length;
        state.restore(); document.querySelector("#clipboard-slot")!.remove();
        return { errors: state.errors, remaining, disposedRead, disposedHostCalls: state.calls.length - before };
      });
      expect(result).toEqual({ errors: [], remaining: 0, disposedRead: "AbortError", disposedHostCalls: 0 });
      expect(pageErrors).toEqual([]);
    }
  });
}
