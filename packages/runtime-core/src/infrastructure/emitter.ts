export class Emitter<T> {
  readonly #listeners = new Set<(event: T) => void>();

  emit(event: T): void {
    for (const listener of [...this.#listeners]) listener(event);
  }

  subscribe(listener: (event: T) => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  clear(): void { this.#listeners.clear(); }
}
