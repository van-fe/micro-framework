import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

export interface ThreeSceneHandle {
  readonly panel: HTMLElement;
  render(): void;
  dispose(): void;
}

export function createThreeScene(root: HTMLElement): ThreeSceneHandle {
  const panel = document.createElement("section");
  panel.className = "matrix-panel";
  const heading = document.createElement("h2");
  heading.textContent = "Three.js scene graph + shader";
  const body = document.createElement("div");
  body.className = "matrix-three";
  const rotate = document.createElement("button");
  rotate.type = "button";
  rotate.className = "matrix-action matrix-three-rotate";
  rotate.textContent = "Rotate 3D scene";
  panel.append(heading, body, rotate);

  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.domElement.className = "matrix-three-canvas";
  renderer.setPixelRatio(1);
  renderer.setSize(420, 240, false);
  body.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x101827);
  const camera = new PerspectiveCamera(45, 420 / 240, 0.1, 100);
  camera.position.z = 3;

  const geometry = new BoxGeometry(1.4, 1.4, 1.4);
  const material = new MeshStandardMaterial({ color: 0x23c483, roughness: 0.4, metalness: 0.15 });
  const cube = new Mesh(geometry, material);
  cube.rotation.set(0.32, 0.48, 0);
  const ambient = new AmbientLight(0xffffff, 1.4);
  const keyLight = new DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(2, 3, 4);
  scene.add(cube, ambient, keyLight);

  const render = () => {
    renderer.render(scene, camera);
    const context = renderer.getContext();
    const pixel = new Uint8Array(4);
    context.readPixels(
      Math.floor(context.drawingBufferWidth / 2),
      Math.floor(context.drawingBufferHeight / 2),
      1,
      1,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixel,
    );
    root.dataset.threePixel = [...pixel].join(",");
    root.dataset.threeObjects = String(scene.children.length);
    root.dataset.threePrograms = String(renderer.info.programs?.length ?? 0);
    root.dataset.threeReady = "true";
  };

  const rotateScene = () => {
    cube.rotation.x += 0.35;
    cube.rotation.y += 0.5;
    render();
    root.dataset.threeRotated = "true";
  };
  rotate.addEventListener("click", rotateScene);

  return {
    panel,
    render,
    dispose() {
      rotate.removeEventListener("click", rotateScene);
      geometry.dispose();
      material.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
