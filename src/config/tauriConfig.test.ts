import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const configPath = resolve(__dirname, "../../src-tauri/tauri.conf.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));

describe("tauri.conf.json", () => {
  it("should disable native drag-drop on the main window so HTML5 events reach the webview", () => {
    const mainWindow = config.app.windows.find(
      (w: { label: string }) => w.label === "main",
    );
    expect(mainWindow).toBeDefined();
    expect(mainWindow.dragDropEnabled).toBe(false);
  });
});

describe("tauri.conf.json content security policy", () => {
  const csp: string = config.app.security.csp;

  /** Split the policy into its directives, keyed by name. */
  const directives = new Map<string, string[]>(
    csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name!, sources] as [string, string[]];
      }),
  );

  const imgSrc = directives.get("img-src") ?? [];

  // The message body is a srcdoc iframe and therefore inherits this policy.
  // Whether a remote image loads is decided by stripRemoteImages() and the
  // image_allowlist table; the policy must not overrule that decision.
  it("permits an image from any https host so an unblocked message can load one", () => {
    expect(imgSrc).toContain("https:");
  });

  it("still permits inline and app-local images", () => {
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain("data:");
  });

  it("does not permit cleartext http images", () => {
    expect(imgSrc).not.toContain("http:");
    expect(imgSrc).not.toContain("*");
  });

  it("does not widen any directive other than img-src", () => {
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(directives.get("frame-src")).toEqual(["'self'"]);
  });
});
