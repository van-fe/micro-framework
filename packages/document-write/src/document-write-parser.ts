import { Parser, Tokenizer, type DefaultTreeAdapterMap, type ParserOptions, type DefaultTreeAdapterTypes as Ast } from "parse5";

class WriteTokenizer extends Tokenizer {
  /** parse5 retains a final text token between chunks; expose it without injecting HTML. */
  flushText(): void { this._emitCurrentCharacterToken(null); }
}

/** parse5 is pinned because incremental script hooks are its public internal API. */
export class DocumentWriteParser extends Parser<DefaultTreeAdapterMap> {
  declare tokenizer: WriteTokenizer;

  constructor(options?: ParserOptions<DefaultTreeAdapterMap>, document?: Ast.Document, context?: Ast.Element | null) {
    super(options, document, context);
    this.tokenizer = new WriteTokenizer(this.options, this);
  }
}
