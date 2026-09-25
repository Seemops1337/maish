// Checks a release's latest.json: every expected platform is present and signed
// with the key src-tauri/tauri.conf.json tells the app to trust.
//
// Usage: node verify-updater-json.mjs <latest.json> <tauri.conf.json> <platform>...
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Key id of a Tauri minisign public key or signature, as uppercase hex. */
export function keyId(minisignB64) {
  const lines = Buffer.from(minisignB64, "base64").toString("utf8").split("\n");
  // Bytes 0–1 name the algorithm, bytes 2–9 are the key id, stored little-endian.
  const box = Buffer.from(lines[1], "base64");
  return Buffer.from(box.subarray(2, 10)).reverse().toString("hex").toUpperCase();
}

/** Problems found in `latest`, one line each; empty when the file is usable. */
export function verifyUpdaterJson(latest, pubkeyB64, platforms) {
  const trusted = keyId(pubkeyB64);
  const problems = [];
  for (const platform of platforms) {
    const entry = latest.platforms?.[platform];
    if (!entry) {
      problems.push(`${platform}: missing from latest.json`);
      continue;
    }
    const signer = keyId(entry.signature);
    if (signer !== trusted) {
      problems.push(`${platform}: signed with key ${signer}, the app trusts ${trusted}`);
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [latestPath, confPath, ...platforms] = process.argv.slice(2);
  const latest = JSON.parse(readFileSync(latestPath, "utf8"));
  const pubkey = JSON.parse(readFileSync(confPath, "utf8")).plugins.updater.pubkey;
  const problems = verifyUpdaterJson(latest, pubkey, platforms);
  if (problems.length > 0) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log(`latest.json ${latest.version}: ${platforms.join(", ")} signed with ${keyId(pubkey)}`);
}
