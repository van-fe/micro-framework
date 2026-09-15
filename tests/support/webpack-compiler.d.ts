import { type Configuration, type Stats } from "webpack";
/** Real webpack output; callers serve the bytes unchanged for native script execution. */
export declare function compileWebpackFixture(configuration: Configuration): Promise<{
    directory: string;
    assets: Map<string, Buffer>;
    stats: Stats;
    dispose(): Promise<void>;
}>;
//# sourceMappingURL=webpack-compiler.d.ts.map