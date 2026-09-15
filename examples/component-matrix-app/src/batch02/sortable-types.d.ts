declare module "sortablejs" {
  export default class Sortable {
    constructor(element: HTMLElement, options?: { animation?: number; onEnd?(event: { oldIndex?: number; newIndex?: number }): void });
    destroy(): void;
  }
}
