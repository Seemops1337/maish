// @vitest-environment node
import { describe, expect, it } from "vitest";
import { keyId, verifyUpdaterJson } from "./verify-updater-json.mjs";

// minisign files as Tauri stores them: base64 of "untrusted comment: …\n<base64 box>\n".
// The box starts with a 2-byte algorithm tag followed by the 8-byte key id, little-endian.
function minisignFile(comment, idHex, extraBytes) {
  const id = Buffer.from(idHex, "hex").reverse();
  const box = Buffer.concat([Buffer.from("Ed"), id, Buffer.alloc(extraBytes)]).toString("base64");
  return Buffer.from(`untrusted comment: ${comment}\n${box}\n`).toString("base64");
}

const PUBKEY = minisignFile("minisign public key: AC3546AC3CF479E1", "AC3546AC3CF479E1", 32);
const signed = (idHex) => minisignFile("signature from tauri secret key", idHex, 64);

function latest(platforms) {
  return {
    version: "0.6.0",
    platforms: Object.fromEntries(
      Object.entries(platforms).map(([name, id]) => [name, { url: `https://example.com/${name}`, signature: signed(id) }]),
    ),
  };
}

describe("keyId", () => {
  it("reads the key id from a public key and from a signature", () => {
    expect(keyId(PUBKEY)).toBe("AC3546AC3CF479E1");
    expect(keyId(signed("3469EDF325AD60F3"))).toBe("3469EDF325AD60F3");
  });
});

describe("verifyUpdaterJson", () => {
  const all = ["darwin-aarch64", "linux-x86_64", "windows-x86_64"];

  it("accepts a file with every platform signed by the trusted key", () => {
    const json = latest({ "darwin-aarch64": "AC3546AC3CF479E1", "linux-x86_64": "AC3546AC3CF479E1", "windows-x86_64": "AC3546AC3CF479E1" });
    expect(verifyUpdaterJson(json, PUBKEY, all)).toEqual([]);
  });

  it("reports a platform that is missing", () => {
    const json = latest({ "darwin-aarch64": "AC3546AC3CF479E1", "windows-x86_64": "AC3546AC3CF479E1" });
    expect(verifyUpdaterJson(json, PUBKEY, all)).toEqual(["linux-x86_64: missing from latest.json"]);
  });

  it("reports a platform signed with another key", () => {
    const json = latest({ "darwin-aarch64": "AC3546AC3CF479E1", "linux-x86_64": "3469EDF325AD60F3", "windows-x86_64": "AC3546AC3CF479E1" });
    expect(verifyUpdaterJson(json, PUBKEY, all)).toEqual([
      "linux-x86_64: signed with key 3469EDF325AD60F3, the app trusts AC3546AC3CF479E1",
    ]);
  });
});
