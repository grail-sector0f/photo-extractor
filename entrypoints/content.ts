// Content script stub — Phase 1 only.
//
// This empty defineContentScript registers the content script in WXT's manifest
// so the entry point exists and matches all URLs. Phase 2 fills in the actual
// image extraction logic here without needing to modify wxt.config.ts.
//
// "matches: ['<all_urls>']" is required in Phase 1 so the manifest is correct.
// Phase 2 will narrow this if needed.

export default defineContentScript({
  matches: ['<all_urls>'],
  main(_ctx) {
    // Phase 2 fills in image extraction logic here.
    // This stub ensures the content script entry is registered in the manifest
    // so Phase 2 can add logic without touching wxt.config.ts.
  },
});
