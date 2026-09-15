import type { ResolvedScript } from "@micro-framework/entry-resolver";

export interface ScheduledScriptResult<Result> {
  readonly index: number;
  readonly script: ResolvedScript;
  readonly result: Result;
}

type Settled<Result> =
  | { readonly ok: true; readonly value: ScheduledScriptResult<Result> }
  | { readonly ok: false; readonly error: unknown };

function isAsync(script: ResolvedScript): boolean {
  return script.async && (script.type === "module" || Boolean(script.src));
}

function isDeferred(script: ResolvedScript): boolean {
  if (isAsync(script)) return false;
  if (script.type === "module") return true;
  return Boolean(script.src && script.defer);
}

function settle<Result>(promise: Promise<ScheduledScriptResult<Result>>): Promise<Settled<Result>> {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
}

export async function scheduleHtmlEntryScripts<Result>(
  scripts: readonly ResolvedScript[],
  execute: (script: ResolvedScript) => Promise<Result>,
  readiness?: { beforeDeferred?(): void; afterDeferred?(): void },
): Promise<readonly ScheduledScriptResult<Result>[]> {
  const results: ScheduledScriptResult<Result>[] = [];
  const deferred: Array<{ script: ResolvedScript; index: number }> = [];
  const asynchronous: Array<Promise<Settled<Result>>> = [];
  let synchronousError: unknown;

  const run = async (script: ResolvedScript, index: number): Promise<ScheduledScriptResult<Result>> => ({
    index,
    script,
    result: await execute(script),
  });

  for (const [index, script] of scripts.entries()) {
    if (isAsync(script)) {
      asynchronous.push(settle(run(script, index)));
      continue;
    }
    if (isDeferred(script)) {
      deferred.push({ script, index });
      continue;
    }
    try {
      results.push(await run(script, index));
    } catch (error) {
      synchronousError = error;
      break;
    }
  }

  if (synchronousError === undefined) {
    readiness?.beforeDeferred?.();
    for (const item of deferred) {
      try {
        results.push(await run(item.script, item.index));
      } catch (error) {
        synchronousError = error;
        break;
      }
    }
  }

  if (synchronousError === undefined) readiness?.afterDeferred?.();
  const settledAsync = await Promise.all(asynchronous);
  const errors: unknown[] = synchronousError === undefined ? [] : [synchronousError];
  for (const item of settledAsync) {
    if (item.ok) results.push(item.value);
    else errors.push(item.error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "Multiple HTML Entry scripts failed.");
  return Object.freeze(results.sort((left, right) => left.index - right.index));
}
