export type ApplicationTemplateFramework = "vanilla" | "react" | "vue" | "vue2";

export interface ApplicationTemplateOptions {
  readonly name: string;
  readonly framework: ApplicationTemplateFramework;
  readonly port?: number;
  readonly workspaceProtocol?: boolean;
  readonly frameworkVersion?: string;
  readonly registry?: string;
}

export interface ApplicationTemplate {
  readonly files: Readonly<Record<string, string>>;
}

function packageName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z\d._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) throw new TypeError("Application template name must contain a letter or number.");
  return normalized;
}

function adapterName(framework: ApplicationTemplateFramework): string {
  return `@micro-framework/adapter-${framework}`;
}

function lifecycleSource(framework: ApplicationTemplateFramework): string {
  const adapter = adapterName(framework);
  switch (framework) {
    case "vanilla":
      return `import { createVanillaLifecycle } from "${adapter}";

interface BusinessProps { title?: string }

const lifecycle = createVanillaLifecycle<BusinessProps>({
  render(props) {
    const main = props.container.ownerDocument.createElement("main");
    main.dataset.application = props.name;
    main.textContent = props.title ?? "Micro application";
    props.container.append(main);
    return () => main.remove();
  },
});

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
`;
    case "react":
      return `import { createReactLifecycle } from "${adapter}";
import { createElement } from "react";

interface BusinessProps { title?: string }

const lifecycle = createReactLifecycle<BusinessProps>({
  render: (props) => createElement("main", { "data-application": props.name }, props.title ?? "Micro application"),
});

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
`;
    case "vue":
      return `import { createVueLifecycle } from "${adapter}";
import { defineComponent, h } from "vue";

const App = defineComponent({
  name: "MicroApplication",
  props: { title: String },
  setup: (props) => () => h("main", props.title ?? "Micro application"),
});
const lifecycle = createVueLifecycle({ component: App });

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
`;
    case "vue2":
      return `import { createVue2Lifecycle } from "${adapter}";
import Vue, { type CreateElement } from "vue";

const lifecycle = createVue2Lifecycle<{ title?: string }>({
  component: Vue.extend({
    name: "MicroApplication",
    props: { title: String },
    render(createElement: CreateElement) {
      return createElement("main", this.title ?? "Micro application");
    },
  }),
});

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
`;
  }
}

function frameworkDependencies(framework: ApplicationTemplateFramework): Record<string, string> {
  switch (framework) {
    case "react": return { react: "19.2.8", "react-dom": "19.2.8" };
    case "vue": return { vue: "3.5.42" };
    case "vue2": return { vue: "2.7.16" };
    case "vanilla": return {};
  }
}

export function createApplicationTemplate(options: ApplicationTemplateOptions): ApplicationTemplate {
  const name = packageName(options.name);
  const port = Math.max(1, Math.min(65_535, options.port ?? 5174));
  if (options.frameworkVersion !== undefined && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(options.frameworkVersion)) {
    throw new TypeError("frameworkVersion must be an exact version, for example 1.2.3 or 1.2.3-beta.1.");
  }
  if (options.frameworkVersion && options.workspaceProtocol === true) {
    throw new TypeError("frameworkVersion cannot be combined with workspaceProtocol: true.");
  }
  if (options.registry) {
    if (!options.frameworkVersion) throw new TypeError("registry requires frameworkVersion.");
    const registry = new URL(options.registry);
    if (!["http:", "https:"].includes(registry.protocol) || registry.username || registry.password || registry.search || registry.hash) {
      throw new TypeError("registry must be an HTTP(S) URL without credentials, query or fragment.");
    }
  }
  const workspaceVersion = options.frameworkVersion ?? (options.workspaceProtocol === false ? "latest" : "workspace:*");
  const dependencies = {
    "@micro-framework/runtime": workspaceVersion,
    [adapterName(options.framework)]: workspaceVersion,
    ...frameworkDependencies(options.framework),
  };
  const packageJson = {
    name: `@micro-app/${name}`,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: `vite --port ${port} --strictPort`,
      build: "vite build",
      typecheck: "tsc -p tsconfig.json --noEmit",
    },
    dependencies,
    devDependencies: {
      "@types/node": "24.3.0",
      ...(options.framework === "react" ? { "@types/react": "19.2.18", "@types/react-dom": "19.2.5" } : {}),
      "@micro-framework/vite-plugin": workspaceVersion,
      typescript: "6.0.3",
      vite: "8.2.2",
    },
  };
  const entryExtension = options.framework === "react" ? "tsx" : "ts";
  const vitePluginPackage = "@micro-framework/vite-plugin";
  const runtimePackage = "@micro-framework/runtime";
  return {
    files: {
      ...(options.registry ? { "bunfig.toml": `[install.scopes]\n"@micro-framework" = ${JSON.stringify(options.registry)}\n` } : {}),
      "package.json": `${JSON.stringify(packageJson, null, 2)}\n`,
      "tsconfig.json": `${JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          skipLibCheck: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          types: ["vite/client"],
        },
        include: ["src", "vite.config.ts"],
      }, null, 2)}\n`,
      "vite.config.ts": `import { microApplication, microHost } from "${vitePluginPackage}";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost(), microApplication({ name: "${name}", entry: "src/lifecycle.${entryExtension}" })],
  optimizeDeps: {
    entries: ["index.html", "src/lifecycle.${entryExtension}"],
    exclude: ["@micro-framework/runtime", "@micro-framework/adapter-${options.framework}"],
    include: ${JSON.stringify(options.framework === "react" ? ["react", "react-dom/client", "react/jsx-runtime"] : [])},
  },
  ${options.framework === "vue" ? 'define: { __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },' : ''}
  server: { host: "127.0.0.1", cors: true, strictPort: true },
});
`,
      "index.html": `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${name}</title></head>
  <body><main id="app"></main><script type="module" src="/src/standalone.ts"></script></body>
</html>
`,
      "src/standalone.ts": `import { createRuntime } from "${runtimePackage}";

const runtime = createRuntime();
const applicationBase = new URL(import.meta.env.BASE_URL, location.href);
const entry = import.meta.env.DEV
  ? new URL("src/lifecycle.${entryExtension}", applicationBase).href
  : new URL((await (await fetch(new URL("micro-frame-manifest.json", applicationBase))).json()).entry, applicationBase).href;
await runtime.mountApp({
  name: "${name}",
  entry: { url: entry, type: "module" },
  container: "#app",
  props: { title: "${name}" },
});
if (import.meta.hot) import.meta.hot.dispose(() => { void runtime.destroy(); });
`,
      [`src/lifecycle.${entryExtension}`]: lifecycleSource(options.framework),
      "README.md": `# ${name}

This micro application uses an external ESM lifecycle entry, iframe Realm execution and Shadow DOM rendering.

\`bun run dev\` starts the standalone page on port ${port}. The lifecycle entry is \`src/lifecycle.${entryExtension}\`.
Run \`bun run build\` to emit \`micro-frame-manifest.json\` with SHA-384 resource metadata.

Keep \`microHost()\` enabled in development and production. It serves/emits the native iframe document
\`__micro_frame__/realm.html\`; the host must serve it as \`200 text/html\` without an SPA fallback.
The default Runtime URL is origin-root \`/__micro_frame__/realm.html\`. If you deploy only under a Vite
\`base\` subpath, configure \`realmDocumentUrl\` explicitly in \`src/standalone.ts\`, for example:

\`\`\`ts
const applicationBase = new URL(import.meta.env.BASE_URL, location.href);
const runtime = createRuntime({
  realmDocumentUrl: new URL("__micro_frame__/realm.html", applicationBase).href,
});
\`\`\`

This resolves the emitted document under the deployment base. If you change its filename, set the matching
\`microHost({ realmDocumentFile: "..." })\` output path as well. The document must remain on the host origin.
`,
    },
  };
}
