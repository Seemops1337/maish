/**
 * HTTP transport for DAV requests.
 *
 * CalDAV/CardDAV servers are ordinary HTTP servers that send no CORS headers —
 * they were never meant to be called from a browser context. A PROPFIND issued
 * by the webview therefore fails with "Load failed" regardless of what
 * `connect-src` permits, because the response carries no
 * `Access-Control-Allow-Origin`.
 *
 * `@tauri-apps/plugin-http` performs the request in Rust, where neither CORS
 * nor CSP applies, and `capabilities/default.json` already grants it
 * `https://*`.
 *
 * Every `DAVClient` must be constructed with `fetch: davFetch`. tsdav resolves
 * its transport once at import time (`const fetch = getFetch()`), preferring
 * `globalThis.fetch` and falling back to cross-fetch only where no global
 * exists — in a webview there always is one, so patching or aliasing the
 * fallback has no effect. The per-client `fetch` option is the only hook that
 * reaches the actual request.
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

type TauriFetchInput = Parameters<typeof tauriFetch>[0];
type TauriFetchInit = Parameters<typeof tauriFetch>[1];

/**
 * `fetch` for DAV requests, backed by the Rust HTTP client.
 *
 * RFC 6764 discovery hinges on reading the redirect itself: a PROPFIND against
 * `/.well-known/caldav` answers 301/302/307/308 with the real endpoint in
 * `Location`, which is why tsdav asks for `redirect: "manual"`. The Rust client
 * ignores that field and only understands `maxRedirections`, so it would follow
 * the hop and hand back the endpoint's response (a bare 401) instead — leaving
 * discovery empty and the account pinned to the bare server URL. Translate the
 * request so the redirect survives.
 */
export const davFetch = (input: TauriFetchInput, init?: TauriFetchInit): Promise<Response> => {
  if (init?.redirect === "manual") {
    const { redirect: _redirect, ...rest } = init;
    return tauriFetch(input, { ...rest, maxRedirections: 0 });
  }
  return tauriFetch(input, init);
};
