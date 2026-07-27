## Problem

After saving a second car, the header pill flips to "reconnecting" even though the WebSocket is still connected (the `/server-connect` page correctly shows "connected"). The pill then stays stuck on "reconnecting".

## Root cause

In `src/lib/data/ServerSync.tsx`, the push-to-server effect calls `setStatus("reconnecting")` whenever `pushSnapshot` throws for any reason other than `unauthorized`:

```ts
} catch (err) {
  const msg = (err as Error).message;
  if (msg === "unauthorized") { ... }
  else { setStatus("reconnecting"); }
}
```

Two problems with this:
1. It overrides the real connection status (WS is still open, so we shouldn't claim the socket is reconnecting).
2. Nothing ever flips it back to `"live"` — `ws.onopen` only fires on a fresh socket open, and the existing socket never closed. So the pill is stuck until the next WS drop or a page reload.

This is also why a failing push is invisible to the user: no toast, and the misleading pill is the only signal.

## Fix (frontend only, `src/lib/data/ServerSync.tsx`)

1. **Stop hijacking the WS-derived status from the push path.** Remove the `setStatus("reconnecting")` in the push `catch`. WS status stays owned by the WS lifecycle handlers.
2. **Retry failed pushes with backoff** inside the push effect (e.g. up to 3 attempts, 500ms → 1s → 2s), so a transient PUT failure recovers instead of silently dropping the write.
3. **Surface push failures to the user.** After retries are exhausted, show a `toast.error("Couldn't save changes to server — will retry")` (throttled so it doesn't spam) and keep `lastPushed.current` unchanged so the next local change (or the next debounce tick) will try again.
4. **Handle `unauthorized` as today** (toast + clear server config).

No changes to WS logic, initial-pull logic, or the pill component itself. The pill will now reflect socket state honestly, and a broken push shows as a toast rather than as a misleading "reconnecting" state.

## Out of scope

The underlying "car disappears on refresh" issue (pushes actually failing over the Cloudflare tunnel) is a separate diagnosis — this change only makes the pill honest and makes push failures visible/retried so we can see what's really happening. If pushes still fail after this, the toast will tell us the HTTP error and we can dig into CORS/tunnel config next.
