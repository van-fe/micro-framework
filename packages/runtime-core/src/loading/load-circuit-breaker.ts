interface FailureState {
  failures: number;
  openUntil: number;
}

export class ApplicationCircuitOpenError extends Error {
  readonly applicationName: string;
  readonly retryAt: number;

  constructor(applicationName: string, retryAt: number) {
    super(`Application load circuit is open for ${applicationName} until ${new Date(retryAt).toISOString()}.`);
    this.name = "ApplicationCircuitOpenError";
    this.applicationName = applicationName;
    this.retryAt = retryAt;
  }
}

export class LoadCircuitBreaker {
  readonly #failureThreshold: number;
  readonly #cooldownMs: number;
  readonly #now: () => number;
  readonly #states = new Map<string, FailureState>();

  constructor(failureThreshold: number, cooldownMs: number, now: () => number = Date.now) {
    this.#failureThreshold = Math.max(1, failureThreshold);
    this.#cooldownMs = Math.max(0, cooldownMs);
    this.#now = now;
  }

  assertAllowed(applicationName: string): void {
    const state = this.#states.get(applicationName);
    if (!state?.openUntil) return;
    const now = this.#now();
    if (state.openUntil > now) throw new ApplicationCircuitOpenError(applicationName, state.openUntil);
    this.#states.delete(applicationName);
  }

  recordFailure(applicationName: string): void {
    const state = this.#states.get(applicationName) ?? { failures: 0, openUntil: 0 };
    state.failures += 1;
    if (state.failures >= this.#failureThreshold) state.openUntil = this.#now() + this.#cooldownMs;
    this.#states.set(applicationName, state);
  }

  recordSuccess(applicationName: string): void {
    this.#states.delete(applicationName);
  }

  clear(): void { this.#states.clear(); }
}
