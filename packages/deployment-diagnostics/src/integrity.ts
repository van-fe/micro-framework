export interface IntegrityVerification {
  readonly status: "verified" | "invalid" | "mismatch";
  readonly algorithm?: "SHA-256" | "SHA-384" | "SHA-512";
}

interface IntegrityToken {
  algorithm: "SHA-256" | "SHA-384" | "SHA-512";
  digest: string;
  strength: number;
}

function parseIntegrityTokens(value: string): IntegrityToken[] {
  const tokens: IntegrityToken[] = [];
  for (const expression of value.trim().split(/\s+/)) {
    const match = /^(sha256|sha384|sha512)-([A-Za-z\d+/]+={0,2})(?:\?.*)?$/.exec(expression);
    if (!match) continue;
    const name = match[1]!;
    tokens.push({
      algorithm: name === "sha256" ? "SHA-256" : name === "sha384" ? "SHA-384" : "SHA-512",
      digest: match[2]!.replace(/=+$/, ""),
      strength: name === "sha256" ? 256 : name === "sha384" ? 384 : 512,
    });
  }
  return tokens;
}

function base64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += alphabet[(value >>> 18) & 63];
    output += alphabet[(value >>> 12) & 63];
    output += second === undefined ? "=" : alphabet[(value >>> 6) & 63];
    output += third === undefined ? "=" : alphabet[value & 63];
  }
  return output;
}

export async function verifySubresourceIntegrity(
  cryptography: Crypto,
  bytes: ArrayBuffer,
  metadata: string,
): Promise<IntegrityVerification> {
  const tokens = parseIntegrityTokens(metadata);
  if (!tokens.length) return { status: "invalid" };
  const strongest = Math.max(...tokens.map(({ strength }) => strength));
  const candidates = tokens.filter(({ strength }) => strength === strongest);
  const algorithm = candidates[0]!.algorithm;
  const digest = base64(new Uint8Array(await cryptography.subtle.digest(algorithm, bytes)))
    .replace(/=+$/, "");
  return {
    status: candidates.some((candidate) => candidate.digest === digest) ? "verified" : "mismatch",
    algorithm,
  };
}
