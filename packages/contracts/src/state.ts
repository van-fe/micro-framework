export interface Store<T extends Record<string, unknown>> {
  get(): Readonly<T>;
  patch(patch: Partial<T>): Readonly<T>;
  subscribe(listener: (next: Readonly<T>, previous: Readonly<T>) => void): () => void;
}
