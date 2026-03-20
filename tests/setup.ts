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
