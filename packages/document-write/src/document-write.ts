import { html, type DefaultTreeAdapterTypes as Ast } from "parse5";
import type { DocumentWriteContext, DocumentWriteController } from "@micro-framework/contracts";
import { DocumentWriteParser } from "./document-write-parser";
import { createWriteTree } from "./document-write-tree";
import { isExecutableWrittenScript, prepareWrittenScript, type WrittenScriptExecution } from "./document-write-script";

interface ScriptRegistration { script: HTMLScriptElement; anchor?: Node; target?: Element; stream?: Stream; stale?: boolean }

interface Stream {
  parser: DocumentWriteParser;
  tree: ReturnType<typeof createWriteTree>;
  pending?: Ast.Element;
  blocked: boolean;
  closed: boolean;
  failed?: unknown;
  executions: Set<WrittenScriptExecution>;
  suspended: Array<{ tail: string; last: boolean; done: boolean; script?: HTMLScriptElement }>;
  registrations: Set<ScriptRegistration>;
}

export function installDocumentWrite(options: DocumentWriteContext): DocumentWriteController {
  const doc = options.frameDocument;
  const nativeOpen = doc.open.bind(doc);
  const baseURL = options.baseURL ?? doc.baseURI;
  const restores: Array<() => void> = [];
  const registered = new WeakMap<HTMLScriptElement, ScriptRegistration>();
  const streams = new Set<Stream>();
  const rootAttributes = new Map<Element, Map<string, string | null>>();
  const staleCaller = (): boolean => Boolean(doc.currentScript && registered.get(doc.currentScript as HTMLScriptElement)?.stale);
  let dynamic: Stream | undefined;
  let destroyed = false;
  let fullDocument = false;
  const releaseCompleted = (stream: Stream): void => {
    if (!stream.closed || stream.failed || stream.executions.size || stream.pending || stream.suspended.length) return;
    streams.delete(stream);
    if (dynamic === stream) dynamic = undefined;
    for (const registration of stream.registrations) registration.stream = undefined;
    stream.registrations.clear();
  };
  const createStream = (target: Element = options.surface.body, anchor?: Node): Stream => {
    const tree = createWriteTree({
      document: options.surface.host.ownerDocument,
      baseURL,
      prepareResource: options.prepareResource,
      rewriteMarkup: options.rewriteMarkup,
      rewriteStyle: options.rewriteStyle,
      nativeCreateElement: options.nativeCreateElement,
      nativeCreateElementNS: options.nativeCreateElementNS,
      trackVisualNode: options.trackVisualNode,
      roots: fullDocument ? { html: options.surface.host, head: options.surface.head, body: options.surface.body } : undefined,
      rootAttributes,
    });
    const parserOptions = { treeAdapter: tree.adapter, scriptingEnabled: true };
    const destination = anchor?.parentNode ?? target;
    const context = destination.nodeType === 1 ? destination as Element : target;
    const contextTag = context === options.surface.head ? "head" : context.localName.startsWith("micro-") ? "body" : context.localName;
    const parser = fullDocument
      ? new DocumentWriteParser(parserOptions)
      : DocumentWriteParser.getFragmentParser(tree.adapter.createElement(contextTag, (context.namespaceURI ?? html.NS.HTML) as html.NS, []), parserOptions) as DocumentWriteParser;
    if (!fullDocument) tree.bindRoot(tree.adapter.getFirstChild(parser.document)!, destination, anchor);
    fullDocument = false;
    const stream: Stream = { parser, tree, blocked: false, closed: false, executions: new Set(), suspended: [], registrations: new Set() };
    parser.scriptHandler = (node) => {
      if (!isExecutableWrittenScript(node)) return;
      stream.pending = node;
      stream.blocked = true;
      parser.tokenizer.pause();
    };
    streams.add(stream);
    return stream;
  };
  const resume = (stream: Stream): void => {
    if (destroyed || stream.failed || !streams.has(stream)) return;
    stream.blocked = false;
    stream.parser.tokenizer.resume();
    stream.parser.tokenizer.flushText();
    drain(stream);
  };
  const drain = (stream: Stream): void => {
    if (!stream.pending || destroyed || stream.failed) return;
    const node = stream.pending;
    stream.pending = undefined;
    // Hold the original input while a script runs. A nested write must finish its
    // own input before the outer parser tail becomes observable to that script.
    const input = stream.parser.tokenizer.preprocessor;
    const suspension: Stream["suspended"][number] = { tail: input.html.slice(input.pos + 1), last: input.lastChunkWritten, done: false };
    input.html = input.html.slice(0, input.pos + 1);
    input.lastChunkWritten = false;
    stream.suspended.push(suspension);
    const complete = (): void => {
      suspension.done = true;
      while (stream.suspended.at(-1)?.done && !destroyed && !stream.failed && streams.has(stream)) {
        const saved = stream.suspended.pop()!;
        stream.parser.tokenizer.write(saved.tail, saved.last);
        if (stream.blocked && !stream.pending) resume(stream);
        else { stream.parser.tokenizer.flushText(); drain(stream); }
      }
      releaseCompleted(stream);
    };
    const execution = prepareWrittenScript({ node, nativeHead: options.nativeHead, createElement: options.nativeCreateElement, baseURL, prepareResource: options.prepareResource });
    suspension.script = execution.script;
    stream.executions.add(execution);
    const registration = { script: execution.script, stream };
    registered.set(execution.script, registration);
    stream.registrations.add(registration);
    if (execution.asynchronous) {
      void execution.completion.then(() => {
        stream.executions.delete(execution);
        try { complete(); }
        catch (error) { stream.failed = error; }
      }, (error: unknown) => { stream.failed = error; stream.executions.delete(execution); });
      execution.start();
    } else {
      try { execution.start(); }
      catch (error) { stream.failed = error; throw error; }
      finally { stream.executions.delete(execution); }
      complete();
    }
  };
  const streamForWrite = (): Stream => {
    const current = doc.currentScript as HTMLScriptElement | null;
    const entry = current ? registered.get(current) : undefined;
    if (entry) {
      if (!entry.stream || !streams.has(entry.stream) || (entry.stream.closed && !entry.stream.executions.size)) entry.stream = createStream(entry.target, entry.anchor);
      entry.stream.registrations.add(entry);
      return entry.stream;
    }
    if (!dynamic || dynamic.closed) dynamic = createStream();
    return dynamic;
  };
  const write = (...values: unknown[]): void => {
    if (destroyed || staleCaller()) return;
    const markup = values.map(String).join("");
    const stream = streamForWrite();
    if (stream.failed) throw stream.failed;
    const current = doc.currentScript as HTMLScriptElement | null;
    const nested = current && [...stream.executions].some((execution) => execution.script === current);
    if (stream.suspended.length && !nested) { stream.suspended[0]!.tail += markup; return; }
    const waiting = stream.suspended.at(-1);
    if (nested && waiting && waiting.script !== current) { waiting.tail += markup; return; }
    if (nested) {
      stream.parser.tokenizer.insertHtmlAtCurrentPos(markup);
      if (stream.blocked && !stream.pending) resume(stream);
    } else stream.parser.tokenizer.write(markup, false);
    stream.parser.tokenizer.flushText();
    drain(stream);
    releaseCompleted(stream);
  };
  const closeStream = (stream: Stream): void => {
    if (stream.closed || stream.failed) return;
    stream.closed = true;
    if (stream.suspended.length) { stream.suspended[0]!.last = true; return; }
    stream.parser.tokenizer.write("", true);
    stream.parser.tokenizer.flushText();
    drain(stream);
    releaseCompleted(stream);
  };
  const reset = (): void => {
    for (const stream of streams) {
      stream.parser.tokenizer.pause();
      stream.pending = undefined;
      for (const execution of stream.executions) execution.cancel();
      for (const registration of stream.registrations) {
        registration.stale = registration.script !== doc.currentScript;
        registration.stream = undefined;
      }
      stream.registrations.clear();
    }
    streams.clear();
    dynamic = undefined;
    for (const [element, attrs] of rootAttributes) {
      for (const [name, value] of attrs) {
        if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
      }
    }
    rootAttributes.clear();
  };
  const define = (key: string, value: unknown): void => {
    const previous = Object.getOwnPropertyDescriptor(doc, key);
    Object.defineProperty(doc, key, { configurable: true, writable: true, value });
    restores.push(() => {
      if (Object.getOwnPropertyDescriptor(doc, key)?.value !== value) return;
      if (previous) Object.defineProperty(doc, key, previous); else Reflect.deleteProperty(doc, key);
    });
  };
  define("write", write);
  define("writeln", (...values: unknown[]) => write(...values, "\n"));
  define("open", (...args: unknown[]) => {
    if (destroyed || staleCaller()) return doc;
    if (args.length >= 3) return Reflect.apply(nativeOpen, doc, args);
    reset();
    options.surface.head.replaceChildren();
    options.surface.body.replaceChildren();
    fullDocument = true;
    return doc;
  });
  define("close", () => { if (!staleCaller()) for (const stream of streams) closeStream(stream); });
  const controller: DocumentWriteController = {
    registerScript(script, anchor, target) { if (!destroyed) registered.set(script, { script, anchor, target }); },
    async flush() {
      while (!destroyed) {
        for (const stream of streams) closeStream(stream);
        const current = [...streams];
        await Promise.all(current.flatMap((stream) => [...stream.executions].map((execution) => execution.completion)));
        const failure = current.find((stream) => stream.failed);
        if (failure) throw failure.failed;
        for (const stream of current) releaseCompleted(stream);
        if (![...streams].some((stream) => stream.executions.size || stream.pending || !stream.closed)) return;
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      reset();
      for (const restore of restores.splice(0).reverse()) restore();
      options.signal?.removeEventListener("abort", controller.destroy);
    },
  };
  options.signal?.addEventListener("abort", controller.destroy, { once: true });
  if (options.signal?.aborted) controller.destroy();
  return controller;
}
