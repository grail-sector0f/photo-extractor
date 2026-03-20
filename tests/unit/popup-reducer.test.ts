/**
 * popup-reducer.test.ts — Unit tests for the popup reducer state machine.
 *
 * Tests every action type to verify state transitions without rendering
 * any React component. The reducer and initialState are exported from
 * App.tsx as named exports specifically to enable this testing pattern.
 *
 * We test reducer logic directly because:
 *   1. No React Testing Library is installed — pure unit tests are simpler
 *   2. All the complex logic (selection, download progress, pre-fill) lives
 *      in the reducer, not in JSX
 *   3. Pure function tests are fast, deterministic, and easy to read
 */

import { describe, it, expect } from 'vitest';
import { popupReducer, initialState } from '../../entrypoints/popup/App';
import type { ImageResult } from '../../lib/extract/types';

// Reusable helper: create a minimal ImageResult for tests
function img(url: string): ImageResult {
  return { url, sourceType: 'img' as const };
}

// ─── Initial State ───────────────────────────────────────────────────────────

describe('initialState', () => {
  it('has scanStatus idle', () => {
    expect(initialState.scanStatus).toBe('idle');
  });

  it('has empty images array', () => {
    expect(initialState.images).toEqual([]);
  });

  it('has empty selected set', () => {
    expect(initialState.selected.size).toBe(0);
  });

  it('has downloadStatus idle', () => {
    expect(initialState.downloadStatus).toBe('idle');
  });

  it('has zero blobCount', () => {
    expect(initialState.blobCount).toBe(0);
  });

  it('has empty form fields', () => {
    expect(initialState.destination).toBe('');
    expect(initialState.vendor).toBe('');
    expect(initialState.category).toBe('');
    expect(initialState.notes).toBe('');
  });
});

// ─── Scan Actions ─────────────────────────────────────────────────────────────

describe('SCAN_STARTED', () => {
  it('sets scanStatus to scanning', () => {
    const state = popupReducer(initialState, { type: 'SCAN_STARTED' });
    expect(state.scanStatus).toBe('scanning');
  });

  it('does not modify images or selected', () => {
    const state = popupReducer(initialState, { type: 'SCAN_STARTED' });
    expect(state.images).toEqual([]);
    expect(state.selected.size).toBe(0);
  });
});

describe('SCAN_RESULT', () => {
  const images = [
    img('https://example.com/1.jpg'),
    img('https://example.com/2.jpg'),
    img('https://example.com/3.jpg'),
  ];

  it('sets scanStatus to done', () => {
    const state = popupReducer(initialState, {
      type: 'SCAN_RESULT',
      payload: { images, blobCount: 0 },
    });
    expect(state.scanStatus).toBe('done');
  });

  it('populates images array', () => {
    const state = popupReducer(initialState, {
      type: 'SCAN_RESULT',
      payload: { images, blobCount: 0 },
    });
    expect(state.images).toHaveLength(3);
    expect(state.images[0].url).toBe('https://example.com/1.jpg');
  });

  it('sets blobCount from payload', () => {
    const state = popupReducer(initialState, {
      type: 'SCAN_RESULT',
      payload: { images, blobCount: 5 },
    });
    expect(state.blobCount).toBe(5);
  });

  it('auto-selects all images', () => {
    const state = popupReducer(initialState, {
      type: 'SCAN_RESULT',
      payload: { images, blobCount: 0 },
    });
    expect(state.selected.size).toBe(3);
    expect(state.selected.has('https://example.com/1.jpg')).toBe(true);
    expect(state.selected.has('https://example.com/2.jpg')).toBe(true);
    expect(state.selected.has('https://example.com/3.jpg')).toBe(true);
  });
});

describe('IMAGE_FOUND', () => {
  it('appends new image to images array', () => {
    const state = popupReducer(initialState, {
      type: 'IMAGE_FOUND',
      payload: img('https://example.com/4.jpg'),
    });
    expect(state.images).toHaveLength(1);
    expect(state.images[0].url).toBe('https://example.com/4.jpg');
  });

  it('adds new image URL to selected set', () => {
    const state = popupReducer(initialState, {
      type: 'IMAGE_FOUND',
      payload: img('https://example.com/4.jpg'),
    });
    expect(state.selected.has('https://example.com/4.jpg')).toBe(true);
  });

  it('accumulates multiple IMAGE_FOUND dispatches', () => {
    let state = popupReducer(initialState, {
      type: 'IMAGE_FOUND',
      payload: img('https://example.com/1.jpg'),
    });
    state = popupReducer(state, {
      type: 'IMAGE_FOUND',
      payload: img('https://example.com/2.jpg'),
    });
    expect(state.images).toHaveLength(2);
    expect(state.selected.size).toBe(2);
  });
});

describe('SCAN_TIMEOUT', () => {
  it('sets scanStatus to timeout', () => {
    const scanning = popupReducer(initialState, { type: 'SCAN_STARTED' });
    const state = popupReducer(scanning, { type: 'SCAN_TIMEOUT' });
    expect(state.scanStatus).toBe('timeout');
  });
});

// ─── Selection Actions ────────────────────────────────────────────────────────

describe('TOGGLE_SELECT', () => {
  const url = 'https://example.com/1.jpg';

  it('adds URL to selected when not already selected', () => {
    const state = popupReducer(initialState, { type: 'TOGGLE_SELECT', url });
    expect(state.selected.has(url)).toBe(true);
  });

  it('removes URL from selected when already selected', () => {
    // First add it
    const withOne = popupReducer(initialState, { type: 'TOGGLE_SELECT', url });
    // Then remove it
    const state = popupReducer(withOne, { type: 'TOGGLE_SELECT', url });
    expect(state.selected.has(url)).toBe(false);
  });

  it('returns a new Set (immutable update)', () => {
    const state = popupReducer(initialState, { type: 'TOGGLE_SELECT', url });
    expect(state.selected).not.toBe(initialState.selected);
  });
});

describe('SELECT_ALL', () => {
  it('adds all image URLs to selected set', () => {
    // Set up state with images from SCAN_RESULT
    const withImages = popupReducer(initialState, {
      type: 'SCAN_RESULT',
      payload: {
        images: [img('https://example.com/1.jpg'), img('https://example.com/2.jpg')],
        blobCount: 0,
      },
    });
    // Clear selection first, then SELECT_ALL
    const cleared = popupReducer(withImages, { type: 'CLEAR_ALL' });
    const state = popupReducer(cleared, { type: 'SELECT_ALL' });
    expect(state.selected.size).toBe(2);
    expect(state.selected.has('https://example.com/1.jpg')).toBe(true);
    expect(state.selected.has('https://example.com/2.jpg')).toBe(true);
  });
});

describe('CLEAR_ALL', () => {
  it('empties selected set', () => {
    // Start with something selected
    const withOne = popupReducer(initialState, {
      type: 'TOGGLE_SELECT',
      url: 'https://example.com/1.jpg',
    });
    const state = popupReducer(withOne, { type: 'CLEAR_ALL' });
    expect(state.selected.size).toBe(0);
  });
});

// ─── Field Change ─────────────────────────────────────────────────────────────

describe('FIELD_CHANGE', () => {
  it('updates destination field', () => {
    const state = popupReducer(initialState, {
      type: 'FIELD_CHANGE',
      field: 'destination',
      value: 'bali',
    });
    expect(state.destination).toBe('bali');
  });

  it('updates vendor field', () => {
    const state = popupReducer(initialState, {
      type: 'FIELD_CHANGE',
      field: 'vendor',
      value: 'four-seasons',
    });
    expect(state.vendor).toBe('four-seasons');
  });

  it('updates category field', () => {
    const state = popupReducer(initialState, {
      type: 'FIELD_CHANGE',
      field: 'category',
      value: 'pool',
    });
    expect(state.category).toBe('pool');
  });

  it('updates notes field', () => {
    const state = popupReducer(initialState, {
      type: 'FIELD_CHANGE',
      field: 'notes',
      value: 'sunset view',
    });
    expect(state.notes).toBe('sunset view');
  });

  it('does not affect other fields when one changes', () => {
    const state = popupReducer(initialState, {
      type: 'FIELD_CHANGE',
      field: 'destination',
      value: 'bali',
    });
    expect(state.vendor).toBe('');
    expect(state.category).toBe('');
    expect(state.notes).toBe('');
  });
});

// ─── Download Actions ─────────────────────────────────────────────────────────

describe('DOWNLOAD_STARTED', () => {
  it('sets downloadStatus to downloading', () => {
    const state = popupReducer(initialState, { type: 'DOWNLOAD_STARTED', total: 5 });
    expect(state.downloadStatus).toBe('downloading');
  });

  it('sets downloadProgress total', () => {
    const state = popupReducer(initialState, { type: 'DOWNLOAD_STARTED', total: 5 });
    expect(state.downloadProgress.total).toBe(5);
    expect(state.downloadProgress.done).toBe(0);
  });
});

describe('DOWNLOAD_PROGRESS', () => {
  it('updates the done count', () => {
    const started = popupReducer(initialState, { type: 'DOWNLOAD_STARTED', total: 5 });
    const state = popupReducer(started, { type: 'DOWNLOAD_PROGRESS', done: 3 });
    expect(state.downloadProgress.done).toBe(3);
  });
});

describe('DOWNLOAD_DONE', () => {
  it('sets downloadStatus to success when 0 failed', () => {
    const state = popupReducer(initialState, {
      type: 'DOWNLOAD_DONE',
      saved: 5,
      failed: 0,
    });
    expect(state.downloadStatus).toBe('success');
  });

  it('sets downloadStatus to partial when some failed', () => {
    const state = popupReducer(initialState, {
      type: 'DOWNLOAD_DONE',
      saved: 3,
      failed: 2,
    });
    expect(state.downloadStatus).toBe('partial');
  });

  it('sets downloadStatus to error when all failed', () => {
    const state = popupReducer(initialState, {
      type: 'DOWNLOAD_DONE',
      saved: 0,
      failed: 5,
    });
    expect(state.downloadStatus).toBe('error');
  });

  it('records saved and failed counts', () => {
    const state = popupReducer(initialState, {
      type: 'DOWNLOAD_DONE',
      saved: 3,
      failed: 2,
    });
    expect(state.downloadSaved).toBe(3);
    expect(state.downloadFailed).toBe(2);
  });
});

// ─── Pre-fill ─────────────────────────────────────────────────────────────────

describe('PREFILL_LOADED', () => {
  it('sets destination, vendor, category from payload', () => {
    const state = popupReducer(initialState, {
      type: 'PREFILL_LOADED',
      destination: 'bali',
      vendor: 'four-seasons',
      category: 'pool',
    });
    expect(state.destination).toBe('bali');
    expect(state.vendor).toBe('four-seasons');
    expect(state.category).toBe('pool');
  });

  it('does not change notes', () => {
    const state = popupReducer(initialState, {
      type: 'PREFILL_LOADED',
      destination: 'bali',
      vendor: 'four-seasons',
      category: 'pool',
    });
    expect(state.notes).toBe('');
  });
});
