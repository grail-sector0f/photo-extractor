// Chrome API mocks for unit tests.
// These replace the real chrome.* APIs that only exist inside an actual browser extension.
// Each mock is a vi.fn() so tests can configure return values or assert call counts.

export const chromeMock = {
  downloads: {
    // search() returns an array of DownloadItem objects from Chrome's download history
    search: vi.fn().mockResolvedValue([]),
    // download() returns the numeric download ID Chrome assigns to the queued file
    download: vi.fn().mockResolvedValue(12345),
  },
  storage: {
    session: {
      // set() persists key-value pairs for the duration of the browser session
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
    },
  },
  runtime: {
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    sendMessage: vi.fn(),
    // onConnect fires in the content script when popup opens a long-lived port
    onConnect: {
      addListener: vi.fn(),
    },
    // connect is called by the popup to open a named port to the content script
    connect: vi.fn(),
  },
};

// Assign to global so any module that calls chrome.* picks up the mock
Object.assign(globalThis, { chrome: chromeMock });

// Reset all mocks between tests so call counts don't bleed across
beforeEach(() => {
  vi.clearAllMocks();
  // Restore default return values after clearAllMocks wipes them
  chromeMock.downloads.search.mockResolvedValue([]);
  chromeMock.downloads.download.mockResolvedValue(12345);
  chromeMock.storage.session.set.mockResolvedValue(undefined);
  chromeMock.storage.session.get.mockResolvedValue({});
});

// Factory function to create mock port objects for testing the scan session lifecycle.
//
// Chrome's Port objects have onMessage and onDisconnect event emitters.
// This mock captures listeners added via addListener so tests can fire them
// programmatically using the _simulateMessage and _simulateDisconnect helpers.
//
// Note: _simulateMessage and _simulateDisconnect are test-only helpers — they don't
// exist on real Chrome Port objects.
export function createMockPort(name = 'scan-session') {
  // Arrays to hold listeners registered during the test
  const messageListeners: Array<(msg: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];

  return {
    name,
    // postMessage sends a message over the port; spy on calls to verify content script output
    postMessage: vi.fn(),
    onMessage: {
      // Captures any message listener the content script registers
      addListener: vi.fn((cb: (msg: unknown) => void) => {
        messageListeners.push(cb);
      }),
    },
    onDisconnect: {
      // Captures any disconnect listener the content script registers
      addListener: vi.fn((cb: () => void) => {
        disconnectListeners.push(cb);
      }),
    },
    disconnect: vi.fn(),
    // Test helper: simulate the popup sending a message into the content script
    _simulateMessage: (msg: unknown) => messageListeners.forEach(cb => cb(msg)),
    // Test helper: simulate the popup closing (port disconnect)
    _simulateDisconnect: () => disconnectListeners.forEach(cb => cb()),
  };
}
