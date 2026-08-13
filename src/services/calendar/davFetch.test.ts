import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { davFetch } from "./davFetch";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
}));

const mockTauriFetch = vi.mocked(tauriFetch);

describe("davFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("translates redirect: manual into maxRedirections: 0", async () => {
    await davFetch("https://dav.example.com/.well-known/caldav", {
      method: "PROPFIND",
      redirect: "manual",
    });

    // The Rust client has no notion of `redirect` — without the translation it
    // follows the well-known redirect and the 3xx response tsdav's service
    // discovery looks for never reaches the caller.
    const init = mockTauriFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: "PROPFIND", maxRedirections: 0 });
    expect(init).not.toHaveProperty("redirect");
  });

  it("leaves other requests untouched", async () => {
    await davFetch("https://dav.example.com/dav/cal", { method: "PROPFIND" });

    const init = mockTauriFetch.mock.calls[0]?.[1];
    expect(init).toEqual({ method: "PROPFIND" });
  });

  it("does not mutate the caller's init object", async () => {
    const init: RequestInit = { method: "PROPFIND", redirect: "manual" };

    await davFetch("https://dav.example.com/.well-known/caldav", init);

    expect(init.redirect).toBe("manual");
  });
});
