// Background service worker — the only context allowed to call chrome.downloads.
//
// IMPORTANT: All runtime code must be inside main(). WXT imports this file in
// a Node.js context during the build for analysis. Any chrome.* call outside
// main() will crash the build ("chrome is not defined"). See RESEARCH.md Pitfall 3.

import { triggerDownload } from '@/lib/download';

export default defineBackground({
  main() {
    // Log once on install so we can confirm the extension loaded correctly
    chrome.runtime.onInstalled.addListener(() => {
      console.log('[photo-extractor] extension installed');
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'DOWNLOAD_FILE') {
        const { url, basename, ext } = message.payload;

        // triggerDownload is async — we must return true to keep the message port
        // open while the promise resolves. Without this, Chrome closes the port
        // before sendResponse is called and the popup never receives the result.
        triggerDownload(url, basename, ext)
          .then((downloadId) => sendResponse({ ok: true, downloadId }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }));

        return true; // keep message port open for async response
      }
    });
  },
});
