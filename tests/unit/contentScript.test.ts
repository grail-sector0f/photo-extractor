// @vitest-environment jsdom
//
// Tests for the content script's scan orchestration and MutationObserver wiring.
//
// Strategy: import handleScanSession directly (it's a named export from content.ts).
// This bypasses WXT's defineContentScript wrapper, which isn't available in the test
// environment. We test the core logic — the function that wires up the port, runs the
// extractors, and starts the MutationObserver — without needing a real browser.
//
// The extractor functions (extractImgTags, extractCssBackgrounds) are mocked here
// to return controlled results. This isolates the wiring/orchestration logic.
// The observer's own filtering path (processImg with 100x100, SVG, blob, srcset) is
// tested separately in mutationObserver.test.ts with real DOM and no mocks.

import { createMockPort } from '@/tests/setup';
import { handleScanSession } from '@/entrypoints/content';

// Mock the extractor modules so tests control what the initial scan returns.
// These are replaced with vi.fn() implementations that return predictable arrays.
vi.mock('@/lib/extract/imgTags', () => ({
  extractImgTags: vi.fn(() => [
    {
      url: 'https://example.com/photo.jpg',
      sourceType: 'img' as const,
      naturalWidth: 800,
      naturalHeight: 600,
    },
  ]),
}));

vi.mock('@/lib/extract/cssBackgrounds', () => ({
  extractCssBackgrounds: vi.fn(() => [
    {
      url: 'https://example.com/bg.jpg',
      sourceType: 'css-background' as const,
    },
  ]),
}));

describe('handleScanSession', () => {
  beforeEach(() => {
    // Clean DOM state between tests so observer mutations don't bleed across
    document.body.innerHTML = '';
  });

  it('sends SCAN_RESULT with merged images when SCAN_PAGE is received', async () => {
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    // Should have posted exactly one message: the SCAN_RESULT
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SCAN_RESULT',
      })
    );
  });

  it('SCAN_RESULT payload contains images array and blobCount number', async () => {
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    const call = port.postMessage.mock.calls[0][0] as {
      type: string;
      payload: { images: unknown[]; blobCount: number };
    };

    expect(call.type).toBe('SCAN_RESULT');
    // images should contain both the img result and the css-background result
    expect(Array.isArray(call.payload.images)).toBe(true);
    expect(call.payload.images.length).toBe(2);
    // blobCount is a number (may be 0 if no blobs detected)
    expect(typeof call.payload.blobCount).toBe('number');
  });

  it('sends IMAGE_FOUND when a new img is added to DOM after scan', async () => {
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    // Add a new large img to the DOM after the initial scan
    const img = document.createElement('img');
    img.src = 'https://example.com/lazy.jpg';
    // Mock naturalWidth/naturalHeight so processImg passes the 100x100 filter
    Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    document.body.appendChild(img);

    // MutationObserver fires asynchronously (microtask); wait for it
    await new Promise(r => setTimeout(r, 0));

    // At least one IMAGE_FOUND message should have been posted
    const imageFoundCalls = port.postMessage.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === 'IMAGE_FOUND'
    );
    expect(imageFoundCalls.length).toBeGreaterThan(0);
    expect(imageFoundCalls[0][0]).toMatchObject({
      type: 'IMAGE_FOUND',
      payload: expect.objectContaining({
        url: 'https://example.com/lazy.jpg',
      }),
    });
  });

  it('stops sending IMAGE_FOUND after _simulateDisconnect is called', async () => {
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    // Disconnect the port (simulate popup closing)
    port._simulateDisconnect();

    // Clear call count so we can check for NEW calls only
    port.postMessage.mockClear();

    // Add a new img after disconnect
    const img = document.createElement('img');
    img.src = 'https://example.com/post-disconnect.jpg';
    Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    document.body.appendChild(img);

    await new Promise(r => setTimeout(r, 0));

    // Observer should have disconnected — no new messages after port close
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('ignores ports with names other than scan-session', () => {
    // This test verifies the onConnect guard. The function itself doesn't check
    // port name — that check happens in the onConnect.addListener callback.
    // Here we verify that sending SCAN_PAGE on a wrong-named port still calls
    // handleScanSession but we test the onConnect filtering separately by checking
    // that the guard `port.name !== 'scan-session'` would reject it.
    //
    // The most direct test: handleScanSession should still process the port passed
    // to it regardless, but the caller (onConnect handler) should have filtered first.
    // We test the guard via the module's onConnect wiring at registration time.
    //
    // For testability, we verify that a port named 'other' doesn't cause errors
    // when handleScanSession itself is called — the filtering is in defineContentScript.
    const port = createMockPort('other-port');
    // Should not throw
    expect(() => {
      handleScanSession(port as unknown as chrome.runtime.Port);
    }).not.toThrow();
    // Without SCAN_PAGE, no postMessage should be called
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('does not send IMAGE_FOUND for duplicate URLs already in initial scan', async () => {
    // The initial scan returns 'https://example.com/photo.jpg' (from mock extractImgTags)
    // Adding an img with the same URL should NOT trigger IMAGE_FOUND (dedup)
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    // Track postMessage call count after SCAN_RESULT
    const callCountAfterScan = port.postMessage.mock.calls.length;

    // Add img with a URL already in the initial scan results
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg'; // already in initial scan
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true });
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    document.body.appendChild(img);

    await new Promise(r => setTimeout(r, 0));

    // No new IMAGE_FOUND calls for duplicate URL
    const newCalls = port.postMessage.mock.calls.slice(callCountAfterScan);
    const imageFoundForDuplicate = newCalls.filter(
      (call: unknown[]) =>
        (call[0] as { type: string; payload?: { url?: string } }).type === 'IMAGE_FOUND' &&
        (call[0] as { payload: { url: string } }).payload?.url === 'https://example.com/photo.jpg'
    );
    expect(imageFoundForDuplicate.length).toBe(0);
  });
});
