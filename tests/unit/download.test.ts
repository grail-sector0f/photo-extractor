// Unit tests for triggerDownload — the full download pipeline.
// Tests verify the call order (keepAlive first, then download) and the arguments
// passed to Chrome's downloads API.

import { triggerDownload } from '@/lib/download';
import { chromeMock } from '../setup';

describe('triggerDownload', () => {
  it('calls keepAlive (storage.session.set) before initiating the download', async () => {
    // keepAlive writes _lastActive so the service worker stays alive through the download.
    // It must be called before chrome.downloads.download, not after.
    await triggerDownload('https://example.com/photo.jpg', 'bali_pool', 'jpg');

    // Both storage.session.set and downloads.download should have been called
    expect(chromeMock.storage.session.set).toHaveBeenCalledTimes(1);
    expect(chromeMock.downloads.download).toHaveBeenCalledTimes(1);

    // storage.session.set must have been called BEFORE downloads.download
    const setOrder = chromeMock.storage.session.set.mock.invocationCallOrder[0];
    const downloadOrder = chromeMock.downloads.download.mock.invocationCallOrder[0];
    expect(setOrder).toBeLessThan(downloadOrder);
  });

  it('passes keepAlive a timestamp via _lastActive key', async () => {
    await triggerDownload('https://example.com/photo.jpg', 'bali_pool', 'jpg');

    const [firstArg] = chromeMock.storage.session.set.mock.calls[0];
    expect(firstArg).toHaveProperty('_lastActive');
    expect(typeof firstArg._lastActive).toBe('number');
  });

  it('calls chrome.downloads.download with filename prefixed by travel-photos/', async () => {
    await triggerDownload('https://example.com/photo.jpg', 'bali_pool', 'jpg');

    const [options] = chromeMock.downloads.download.mock.calls[0];
    expect(options.filename).toMatch(/^travel-photos\//);
  });

  it('calls chrome.downloads.download with saveAs: false', async () => {
    // saveAs: false means no Save dialog — files go straight to Downloads
    await triggerDownload('https://example.com/photo.jpg', 'bali_pool', 'jpg');

    const [options] = chromeMock.downloads.download.mock.calls[0];
    expect(options.saveAs).toBe(false);
  });

  it('calls chrome.downloads.download with conflictAction: overwrite', async () => {
    // We handle collision avoidance ourselves via buildSafeFilename, so "overwrite" is safe
    await triggerDownload('https://example.com/photo.jpg', 'bali_pool', 'jpg');

    const [options] = chromeMock.downloads.download.mock.calls[0];
    expect(options.conflictAction).toBe('overwrite');
  });

  it('passes the correct URL to chrome.downloads.download', async () => {
    const url = 'https://example.com/photo.jpg';
    await triggerDownload(url, 'bali_pool', 'jpg');

    const [options] = chromeMock.downloads.download.mock.calls[0];
    expect(options.url).toBe(url);
  });

  it('returns the download ID from chrome.downloads.download', async () => {
    // chrome.downloads.download returns a numeric ID; triggerDownload should pass it through
    chromeMock.downloads.download.mockResolvedValue(99);

    const id = await triggerDownload('https://example.com/photo.jpg', 'bali_pool', 'jpg');

    expect(id).toBe(99);
  });
});
