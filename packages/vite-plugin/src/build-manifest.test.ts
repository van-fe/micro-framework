import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBuildManifest, serializeUnsignedManifest } from "./build-manifest";

describe("createBuildManifest", () => {
  it("produces deterministic module graph, shared requirements, and SHA-384 metadata", () => {
    const manifest = createBuildManifest("orders", [
      {
        fileName: "assets/shared.js",
        isEntry: false,
        imports: [],
        dynamicImports: [],
        code: "export const shared = true;",
      },
      {
        fileName: "assets/orders.js",
        isEntry: true,
        facadeModuleId: "/repo/src/lifecycle.ts",
        imports: ["assets/shared.js"],
        dynamicImports: ["assets/lazy.js"],
        code: "export const mount = () => {};",
      },
    ], [{ fileName: "assets/orders.css", source: ".orders{}" }], "src/lifecycle.ts", {
      sharedDependencies: { imports: { react: "^19.0.0" } },
    });

    expect(manifest).toEqual({
      schemaVersion: 2,
      application: "orders",
      entry: "assets/orders.js",
      chunks: [
        {
          file: "assets/orders.js",
          entry: true,
          imports: ["assets/shared.js"],
          dynamicImports: ["assets/lazy.js"],
          integrity: expect.stringMatching(/^sha384-/),
        },
        {
          file: "assets/shared.js",
          entry: false,
          imports: [],
          dynamicImports: [],
          integrity: expect.stringMatching(/^sha384-/),
        },
      ],
      assets: [{ file: "assets/orders.css", integrity: expect.stringMatching(/^sha384-/) }],
      sharedDependencies: { imports: { react: "^19.0.0" } },
    });
  });

  it("optionally signs the canonical manifest with Ed25519", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const manifest = createBuildManifest("signed", [], [], undefined, {
      signing: {
        algorithm: "Ed25519",
        keyId: "release-2026",
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      },
    });
    const { signature, ...unsigned } = manifest;

    expect(signature).toMatchObject({ algorithm: "Ed25519", keyId: "release-2026" });
    expect(verify(
      null,
      new TextEncoder().encode(serializeUnsignedManifest(unsigned)),
      publicKey,
      Buffer.from(signature!.value, "base64"),
    )).toBe(true);
  });
});
