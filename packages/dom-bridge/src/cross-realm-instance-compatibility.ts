const CROSS_REALM_CONSTRUCTORS = [
  "AnimationEvent",
  "Comment",
  "CSSStyleDeclaration",
  "CSSStyleSheet",
  "CustomEvent",
  "DocumentFragment",
  "Element",
  "Event",
  "EventTarget",
  "FocusEvent",
  "HTMLElement",
  "HTMLCollection",
  "InputEvent",
  "KeyboardEvent",
  "MouseEvent",
  "Node",
  "NodeList",
  "PointerEvent",
  "Range",
  "Selection",
  "SVGElement",
  "Text",
  "TransitionEvent",
  "UIEvent",
] as const;

type RealmConstructor = Function & {
  readonly prototype: object;
};

const ordinaryHasInstance = Function.prototype[Symbol.hasInstance] as (
  this: RealmConstructor,
  value: unknown,
) => boolean;
const installedWindows = new WeakSet<Window>();

function createDualRealmConstructor(
  frameConstructor: RealmConstructor,
  hostConstructor: RealmConstructor,
  constructInHostDocument: boolean,
): RealmConstructor {
  const hasInstance = (value: unknown): boolean =>
    ordinaryHasInstance.call(frameConstructor, value)
      || ordinaryHasInstance.call(hostConstructor, value);

  return new Proxy(frameConstructor, {
    construct(target, argumentsList, newTarget) {
      // Visible nodes belong to the host Document. A constructed sheet must be
      // created by that Document's constructor to be adoptable by their roots.
      // Keep the application's newTarget/prototype, including subclass identity.
      return Reflect.construct(
        constructInHostDocument ? hostConstructor : target,
        argumentsList,
        newTarget,
      );
    },
    get(target, key) {
      if (key === Symbol.hasInstance) return hasInstance;
      return Reflect.get(target, key, target);
    },
  });
}

export function installCrossRealmInstanceCompatibility(frameWindow: Window, hostWindow: Window): void {
  if (installedWindows.has(frameWindow)) return;
  installedWindows.add(frameWindow);
  const frameRecord = frameWindow as unknown as Record<string, unknown>;
  const hostRecord = hostWindow as unknown as Record<string, unknown>;

  for (const name of CROSS_REALM_CONSTRUCTORS) {
    const frameConstructor = frameRecord[name];
    const hostConstructor = hostRecord[name];
    if (typeof frameConstructor !== "function" || typeof hostConstructor !== "function") continue;
    try {
      Object.defineProperty(frameWindow, name, {
        configurable: true,
        writable: true,
        value: createDualRealmConstructor(
          frameConstructor as RealmConstructor,
          hostConstructor as RealmConstructor,
          name === "CSSStyleSheet",
        ),
      });
    } catch {
      // Keep the iframe-native constructor when a browser seals the global property.
    }
  }
}
