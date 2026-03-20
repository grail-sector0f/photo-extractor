import { defineConfig } from 'wxt';

export default defineConfig({
  // Wire in the React module — handles JSX transform and React types automatically
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Photo Extractor',
    description: 'Save travel photos with structured naming',
    // downloads: needed to call chrome.downloads.download() and search()
    // storage: needed for chrome.storage.session (SW keepalive) and future preferences
    permissions: ['downloads', 'storage'],
  },
});
