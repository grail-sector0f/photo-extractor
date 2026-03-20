/**
 * keepAlive — prevent Chrome from terminating the service worker mid-operation.
 *
 * Chrome MV3 service workers are "event-driven" — Chrome can terminate them after
 * ~30 seconds of idle. Any Chrome API call resets this idle timer. Writing a small
 * key to chrome.storage.session is the cheapest way to do that.
 *
 * Call this at the start of any async operation that might run longer than a few seconds.
 */
export async function keepAlive(): Promise<void> {
  await chrome.storage.session.set({ _lastActive: Date.now() });
}
