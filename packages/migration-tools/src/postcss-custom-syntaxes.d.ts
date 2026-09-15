declare module "postcss-sass" {
  import type { Parser, Stringifier } from "postcss";

  const syntax: {
    readonly parse: Parser;
    readonly stringify: Stringifier;
  };

  export default syntax;
}

declare module "postcss-styl" {
  import type { Parser, Stringifier } from "postcss";

  const syntax: {
    readonly parse: Parser;
    readonly stringify: Stringifier;
  };

  export default syntax;
}
