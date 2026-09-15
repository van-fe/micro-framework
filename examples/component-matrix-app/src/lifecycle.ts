import { createVanillaLifecycle } from "@micro-framework/adapter-vanilla";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Map as MapLibreMap,
  setWorkerUrl as setMapLibreWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import "monaco-editor/language/json/monaco.contribution.js";
import JsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import "./style.css";
import { createThreeScene } from "./three-scene";

echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer]);
setMapLibreWorkerUrl(new URL(mapLibreWorkerUrl, import.meta.url).href);

const realmGlobal = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker(workerId: string, label: string): Worker;
  };
};
realmGlobal.MonacoEnvironment = {
  getWorker: (_workerId, label) => label === "json" ? new JsonWorker() : new EditorWorker(),
};

const localMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    realm: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { name: "Realm vector point" },
          geometry: { type: "Point", coordinates: [121.4737, 31.2304] },
        }],
      },
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e8f3ff" } },
    {
      id: "realm-point",
      type: "circle",
      source: "realm",
      paint: {
        "circle-color": "#e34b6f",
        "circle-radius": 12,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    },
  ],
};

function panel(title: string): { panel: HTMLElement; body: HTMLDivElement } {
  const element = document.createElement("section");
  element.className = "matrix-panel";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const body = document.createElement("div");
  element.append(heading, body);
  return { panel: element, body };
}

const lifecycle = createVanillaLifecycle({
  render(props) {
    const root = document.createElement("main");
    root.className = "component-matrix";
    root.dataset.instanceId = props.$runtime.instanceId;
    props.container.append(root);

    const editorPanel = panel("Quill rich text");
    editorPanel.body.className = "matrix-editor-shell";
    const editorElement = document.createElement("div");
    editorPanel.body.append(editorElement);
    root.append(editorPanel.panel);
    const editor = new Quill(editorElement, {
      theme: "snow",
      modules: { toolbar: [["bold", "italic"], [{ header: [1, 2, false] }]] },
    });
    editor.on("text-change", () => {
      root.dataset.editorText = editor.getText().trim();
    });
    editor.setText("Realm editor ready");
    editor.formatText(0, 5, "bold", true);

    const monacoPanel = panel("Monaco JSON editor + language Worker");
    const monacoElement = document.createElement("div");
    monacoElement.className = "matrix-monaco";
    monacoPanel.body.append(monacoElement);
    root.append(monacoPanel.panel);
    const monacoModel = monaco.editor.createModel(
      `{\n  "realm": true\n}`,
      "json",
      monaco.Uri.parse(`inmemory://component-matrix/${props.$runtime.instanceId}.json`),
    );
    const monacoEditor = monaco.editor.create(monacoElement, {
      model: monacoModel,
      automaticLayout: true,
      ariaLabel: "Monaco JSON editor probe",
      minimap: { enabled: false },
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      tabSize: 2,
    });
    root.dataset.monacoValue = monacoModel.getValue();
    const monacoContentSubscription = monacoModel.onDidChangeContent(() => {
      root.dataset.monacoValue = monacoModel.getValue();
    });
    const updateMonacoMarkers = () => {
      root.dataset.monacoMarkers = String(monaco.editor.getModelMarkers({ resource: monacoModel.uri }).length);
    };
    const monacoMarkerSubscription = monaco.editor.onDidChangeMarkers((resources) => {
      if (resources.some((resource) => resource.toString() === monacoModel.uri.toString())) updateMonacoMarkers();
    });
    updateMonacoMarkers();

    const chartPanel = panel("Apache ECharts SVG");
    const chartElement = document.createElement("div");
    chartElement.className = "matrix-chart";
    chartPanel.body.append(chartElement);
    const updateChart = document.createElement("button");
    updateChart.type = "button";
    updateChart.className = "matrix-action matrix-chart-update";
    updateChart.textContent = "Update chart";
    chartPanel.panel.append(updateChart);
    root.append(chartPanel.panel);
    const chart = echarts.init(chartElement, undefined, { renderer: "svg" });
    const chartOption = (values: number[]) => ({
      animation: false,
      grid: { left: 32, right: 12, top: 18, bottom: 28 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: ["A", "B", "C"] },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: values }],
    });
    chart.setOption(chartOption([12, 24, 18]));
    updateChart.addEventListener("click", () => {
      chart.setOption(chartOption([22, 14, 30]));
      root.dataset.chartUpdated = "true";
    });

    const mapPanel = panel("Leaflet vector map");
    const mapElement = document.createElement("div");
    mapElement.className = "matrix-map";
    mapPanel.body.append(mapElement);
    const panMap = document.createElement("button");
    panMap.type = "button";
    panMap.className = "matrix-action matrix-map-pan";
    panMap.textContent = "Pan map";
    mapPanel.panel.append(panMap);
    root.append(mapPanel.panel);
    const map = L.map(mapElement, {
      attributionControl: false,
      zoomControl: true,
      fadeAnimation: false,
      zoomAnimation: false,
    }).setView([31.2304, 121.4737], 12);
    L.circleMarker([31.2304, 121.4737], {
      radius: 10,
      color: "#0b8f7c",
      fillColor: "#0b8f7c",
      fillOpacity: 0.65,
    }).addTo(map).bindPopup("Realm map marker").openPopup();
    panMap.addEventListener("click", () => {
      map.panBy([32, 0], { animate: false });
      root.dataset.mapMoved = "true";
    });

    const mapLibrePanel = panel("MapLibre GL local GeoJSON");
    const mapLibreElement = document.createElement("div");
    mapLibreElement.className = "matrix-maplibre";
    mapLibrePanel.body.append(mapLibreElement);
    const jumpMapLibre = document.createElement("button");
    jumpMapLibre.type = "button";
    jumpMapLibre.className = "matrix-action matrix-maplibre-jump";
    jumpMapLibre.textContent = "Jump WebGL map";
    mapLibrePanel.panel.append(jumpMapLibre);
    root.append(mapLibrePanel.panel);
    const mapLibre = new MapLibreMap({
      container: mapLibreElement,
      style: localMapStyle,
      center: [121.4737, 31.2304],
      zoom: 10,
      interactive: false,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapLibre.on("error", (event) => {
      root.dataset.maplibreError = event.error.message;
    });
    const markMapLibreReady = () => {
      if (!mapLibre.getSource("realm")) return;
      const featureCount = mapLibre.querySourceFeatures("realm").length;
      root.dataset.maplibreFeatures = String(featureCount);
      if (featureCount === 0) return;
      root.dataset.maplibreReady = "true";
      mapLibre.off("render", markMapLibreReady);
      mapLibre.off("sourcedata", markMapLibreReady);
    };
    mapLibre.on("load", () => {
      root.dataset.maplibreStyleLoaded = "true";
      markMapLibreReady();
    });
    mapLibre.on("render", markMapLibreReady);
    mapLibre.on("sourcedata", markMapLibreReady);
    jumpMapLibre.addEventListener("click", () => {
      mapLibre.jumpTo({ center: [121.48, 31.24], zoom: 11 });
      root.dataset.maplibreMoved = "true";
    });

    const threeScene = createThreeScene(root);
    root.append(threeScene.panel);

    const platformPanel = panel("Worker, WebGL, and text input");
    platformPanel.body.className = "matrix-platform";
    const textInput = document.createElement("textarea");
    textInput.className = "matrix-text-input";
    textInput.setAttribute("aria-label", "Multilingual editor probe");
    textInput.addEventListener("beforeinput", (event) => {
      root.dataset.beforeInput = (event as InputEvent).inputType;
    });
    textInput.addEventListener("input", () => {
      root.dataset.textInput = textInput.value;
    });
    textInput.addEventListener("compositionstart", (event) => {
      root.dataset.composition = `start:${event.data}`;
    });
    textInput.addEventListener("compositionend", (event) => {
      root.dataset.composition = `end:${event.data}`;
    });
    const canvas = document.createElement("canvas");
    canvas.className = "matrix-webgl";
    canvas.width = 16;
    canvas.height = 16;
    platformPanel.body.append(textInput, canvas);
    root.append(platformPanel.panel);

    const worker = new Worker(new URL("./matrix-worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<{
      total: number;
      echoed: Map<string, string>;
    }>) => {
      root.dataset.workerResult = `${event.data.total}:${event.data.echoed.get("worker")}`;
    });
    worker.postMessage({ values: [2, 3, 5] });

    const webgl = canvas.getContext("webgl");
    if (webgl) {
      webgl.clearColor(0.1, 0.6, 0.3, 1);
      webgl.clear(webgl.COLOR_BUFFER_BIT);
      const pixel = new Uint8Array(4);
      webgl.readPixels(0, 0, 1, 1, webgl.RGBA, webgl.UNSIGNED_BYTE, pixel);
      root.dataset.webglPixel = [...pixel].join(",");
    } else {
      root.dataset.webglPixel = "unavailable";
    }

    requestAnimationFrame(() => {
      chart.resize();
      map.invalidateSize({ pan: false });
      monacoEditor.layout();
      mapLibre.resize();
      threeScene.render();
      root.dataset.ready = "true";
    });

    return () => {
      editor.disable();
      monacoContentSubscription.dispose();
      monacoMarkerSubscription.dispose();
      monacoEditor.dispose();
      monacoModel.dispose();
      worker.terminate();
      webgl?.getExtension("WEBGL_lose_context")?.loseContext();
      chart.dispose();
      map.remove();
      mapLibre.remove();
      threeScene.dispose();
      root.remove();
    };
  },
});

export const mount = lifecycle.mount;
export const unmount = lifecycle.unmount;
