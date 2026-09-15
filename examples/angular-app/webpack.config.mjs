import { fileURLToPath } from "node:url";
import { MicroApplicationWebpackPlugin, MicroHostWebpackPlugin } from "@micro-framework/webpack-plugin";
export default {
  mode: "production", entry: { "micro-entry": "./.compiled/lifecycle.js" },
  experiments: { outputModule: true },
  output: { path: fileURLToPath(new URL("./dist-webpack/", import.meta.url)), filename: "[name].[contenthash].js", chunkFilename: "[name].[contenthash].js", module: true, library: { type: "module" }, clean: true },
  resolve: { extensions: [".js"] },
  module: { rules: [{ test: /\.[cm]?js$/, loader: fileURLToPath(new URL("./angular-linker-loader.cjs", import.meta.url)) }] },
  devtool: "source-map",
  plugins: [new MicroHostWebpackPlugin(), new MicroApplicationWebpackPlugin({ name: "angular-orders" })],
};
