import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import webpack, { type Configuration, type Stats } from "webpack";

/** Real webpack output; callers serve the bytes unchanged for native script execution. */
export async function compileWebpackFixture(configuration: Configuration): Promise<{
  directory: string;
  assets: Map<string, Buffer>;
  stats: Stats;
  dispose(): Promise<void>;
}> {
  const directory = await mkdtemp(join(tmpdir(), "micro-frame-webpack-fixture-"));
  const compiler = webpack({
    mode: "production",
    devtool: "source-map",
    ...configuration,
    output: { ...configuration.output, path: directory },
  });
  try {
    const stats = await new Promise<Stats>((resolve, reject) => {
      compiler.run((runError, result) => {
        compiler.close((closeError) => {
          if (runError || closeError) reject(runError ?? closeError);
          else if (!result || result.hasErrors()) reject(new Error(result?.toString({ all: false, errors: true }) ?? "webpack emitted no result"));
          else resolve(result);
        });
      });
    });
    const assets = new Map<string, Buffer>();
    for (const file of await readdir(directory, { recursive: true, withFileTypes: true })) {
      if (!file.isFile()) continue;
      const path = join(file.parentPath, file.name);
      assets.set(relative(directory, path).replaceAll("\\", "/"), await readFile(path));
    }
    return { directory, assets, stats, dispose: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
