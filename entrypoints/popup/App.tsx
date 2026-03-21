/**
 * App.tsx — Complete popup UI for the Photo Extractor extension.
 *
 * Replaces the Phase 1 stub. This file contains the full component tree inline
 * (all components are small enough that splitting into separate files adds overhead
 * without meaningful readability gain at this scale).
 *
 * Architecture overview:
 *   - useReducer manages all popup state (scan status, images, selection, form fields,
 *     download progress). Reducer is used instead of multiple useState calls because
 *     async download callbacks need to update multiple fields together — useReducer
 *     avoids stale closure bugs that would occur with multiple disconnected setState calls.
 *   - Scan: popup opens idle. "Scan Page" button connects a long-lived port to the
 *     content script, which runs the extraction and sends SCAN_RESULT.
 *   - Download: selected image URLs are sent one-by-one to the background service
 *     worker via DOWNLOAD_FILE messages. The background has access to chrome.downloads;
 *     the popup does not.
 *   - Pre-fill: chrome.storage.local persists the last-used destination/vendor/category
 *     and restores them on mount.
 */

import { useReducer, useEffect } from 'react';
import { buildBasename, deriveExt } from '../../lib/naming';
import type { ImageResult } from '../../lib/extract/types';
// CDN URL rewriting -- applies at download time only. Thumbnails in the grid use
// original extracted URLs. See lib/cdnRewrite.ts for supported CDN patterns.
import { rewriteUrlForMaxResolution } from '../../lib/cdnRewrite';

// ─── State Types ──────────────────────────────────────────────────────────────

type ScanStatus = 'idle' | 'scanning' | 'done' | 'timeout';
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'partial' | 'error';

interface PopupState {
  scanStatus: ScanStatus;
  images: ImageResult[];
  blobCount: number;
  // Set of image URLs the user has selected (blue ring + checkmark in the grid)
  selected: Set<string>;
  // Naming form fields
  destination: string;
  vendor: string;
  category: string;
  notes: string;
  downloadStatus: DownloadStatus;
  downloadProgress: { done: number; total: number };
  downloadSaved: number;
  downloadFailed: number;
}

// ─── Action Types ─────────────────────────────────────────────────────────────

type Action =
  | { type: 'SCAN_STARTED' }
  | { type: 'SCAN_RESULT'; payload: { images: ImageResult[]; blobCount: number } }
  | { type: 'IMAGE_FOUND'; payload: ImageResult }
  | { type: 'SCAN_TIMEOUT' }
  | { type: 'TOGGLE_SELECT'; url: string }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_ALL' }
  | { type: 'FIELD_CHANGE'; field: 'destination' | 'vendor' | 'category' | 'notes'; value: string }
  | { type: 'DOWNLOAD_STARTED'; total: number }
  | { type: 'DOWNLOAD_PROGRESS'; done: number }
  | { type: 'DOWNLOAD_DONE'; saved: number; failed: number }
  | { type: 'PREFILL_LOADED'; destination: string; vendor: string; category: string };

// ─── Initial State ────────────────────────────────────────────────────────────

export const initialState: PopupState = {
  scanStatus: 'idle',
  images: [],
  blobCount: 0,
  selected: new Set(),
  destination: '',
  vendor: '',
  category: '',
  notes: '',
  downloadStatus: 'idle',
  downloadProgress: { done: 0, total: 0 },
  downloadSaved: 0,
  downloadFailed: 0,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

/**
 * Pure reducer function for all popup state transitions.
 * Exported so tests can drive it directly without rendering React.
 */
export function popupReducer(state: PopupState, action: Action): PopupState {
  switch (action.type) {
    case 'SCAN_STARTED':
      // Clear previous scan results so stale images/selection don't persist
      // into the new scan. Form fields (destination/vendor/category/notes) are
      // intentionally preserved — the user expects those to carry over.
      return {
        ...state,
        scanStatus: 'scanning',
        images: [],
        blobCount: 0,
        selected: new Set(),
        downloadStatus: 'idle',
        downloadProgress: { done: 0, total: 0 },
        downloadSaved: 0,
        downloadFailed: 0,
      };

    case 'SCAN_RESULT': {
      const { images, blobCount } = action.payload;
      // Auto-select all images when scan completes — Jennifer sees everything
      // selected and deselects what she doesn't want (her expected workflow)
      const selected = new Set(images.map((img) => img.url));
      return { ...state, scanStatus: 'done', images, blobCount, selected };
    }

    case 'IMAGE_FOUND': {
      // Streaming mode: add each new image and auto-select it
      const newImages = [...state.images, action.payload];
      const newSelected = new Set(state.selected);
      newSelected.add(action.payload.url);
      return { ...state, images: newImages, selected: newSelected };
    }

    case 'SCAN_TIMEOUT':
      return { ...state, scanStatus: 'timeout' };

    case 'TOGGLE_SELECT': {
      const newSelected = new Set(state.selected);
      if (newSelected.has(action.url)) {
        newSelected.delete(action.url);
      } else {
        newSelected.add(action.url);
      }
      return { ...state, selected: newSelected };
    }

    case 'SELECT_ALL': {
      const allSelected = new Set(state.images.map((img) => img.url));
      return { ...state, selected: allSelected };
    }

    case 'CLEAR_ALL':
      return { ...state, selected: new Set() };

    case 'FIELD_CHANGE':
      return { ...state, [action.field]: action.value };

    case 'DOWNLOAD_STARTED':
      return {
        ...state,
        downloadStatus: 'downloading',
        downloadProgress: { done: 0, total: action.total },
        downloadSaved: 0,
        downloadFailed: 0,
      };

    case 'DOWNLOAD_PROGRESS':
      return {
        ...state,
        downloadProgress: { ...state.downloadProgress, done: action.done },
      };

    case 'DOWNLOAD_DONE': {
      const { saved, failed } = action;
      // Determine outcome: success = 0 failures, partial = some failed but not all,
      // error = all failed (saved === 0 and failed > 0)
      let downloadStatus: DownloadStatus;
      if (failed === 0) {
        downloadStatus = 'success';
      } else if (saved === 0) {
        downloadStatus = 'error';
      } else {
        downloadStatus = 'partial';
      }
      return { ...state, downloadStatus, downloadSaved: saved, downloadFailed: failed };
    }

    case 'PREFILL_LOADED':
      return {
        ...state,
        destination: action.destination,
        vendor: action.vendor,
        category: action.category,
      };

    default:
      return state;
  }
}

// ─── Chrome Messaging Helpers ─────────────────────────────────────────────────

/**
 * Send a DOWNLOAD_FILE message to the background service worker.
 *
 * Downloads go through the background because chrome.downloads is only
 * available in the service worker context — the popup cannot call it directly.
 */
function sendDownloadMessage(url: string, basename: string, ext: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'DOWNLOAD_FILE', payload: { url, basename, ext } },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.ok) {
          resolve();
        } else {
          reject(new Error(response?.error ?? 'unknown error'));
        }
      },
    );
  });
}

/**
 * Connect a long-lived port to the content script and request a page scan.
 *
 * Uses chrome.tabs.connect(tabId) — NOT chrome.runtime.connect(). The distinction
 * matters: chrome.runtime.connect() opens a port to the background service worker,
 * while chrome.tabs.connect(tabId) opens a port to the content script running in
 * a specific tab. The content script's chrome.runtime.onConnect fires only for the latter.
 */
async function startScan(dispatch: React.Dispatch<Action>): Promise<void> {
  dispatch({ type: 'SCAN_STARTED' });

  // Query the tab this popup is attached to. currentWindow: true is required because
  // the popup is always opened from the active window's toolbar.
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id) {
    // No active tab (e.g., popup opened from chrome://extensions). Show timeout.
    dispatch({ type: 'SCAN_TIMEOUT' });
    return;
  }

  let port: chrome.runtime.Port;
  try {
    // Open port directly to the content script in this tab.
    // Will throw if the content script isn't injected (e.g., chrome:// page,
    // or the tab was open when the extension was first installed/reloaded).
    port = chrome.tabs.connect(tab.id, { name: 'scan-session' });
  } catch {
    dispatch({ type: 'SCAN_TIMEOUT' });
    return;
  }

  const timer = setTimeout(() => dispatch({ type: 'SCAN_TIMEOUT' }), 5000);

  port.onMessage.addListener((msg: { type: string; payload: unknown }) => {
    if (msg.type === 'SCAN_RESULT') {
      const { images, blobCount } = msg.payload as { images: ImageResult[]; blobCount: number };
      dispatch({ type: 'SCAN_RESULT', payload: { images, blobCount } });
      clearTimeout(timer);
    }
    if (msg.type === 'IMAGE_FOUND') {
      dispatch({ type: 'IMAGE_FOUND', payload: msg.payload as ImageResult });
    }
  });

  // If the port disconnects before SCAN_RESULT arrives (e.g., content script crashed
  // or the tab navigated away), cancel the timer to avoid a stale SCAN_TIMEOUT dispatch.
  port.onDisconnect.addListener(() => {
    clearTimeout(timer);
  });

  port.postMessage({ type: 'SCAN_PAGE' });
}

/**
 * Run downloads for all selected URLs in parallel using Promise.allSettled.
 *
 * Promise.allSettled (not Promise.all) is used so that individual failures
 * don't abort the entire batch — we want "Saved 3 of 5, 2 failed" reporting.
 *
 * After completion, persists destination/vendor/category to chrome.storage.local
 * so they pre-fill the next time Jennifer opens the popup.
 */
async function runDownloads(
  selectedUrls: string[],
  basename: string,
  state: PopupState,
  dispatch: React.Dispatch<Action>,
): Promise<void> {
  dispatch({ type: 'DOWNLOAD_STARTED', total: selectedUrls.length });
  let done = 0;

  // Assign numbered basenames before any downloads start to avoid a race condition.
  // If all downloads run in parallel and each calls buildSafeFilename independently,
  // they all see the same Chrome download history (empty, because nothing has finished
  // yet) and all claim the same filename. With conflictAction:'overwrite' each download
  // then silently overwrites the previous one, leaving a single file at the end.
  //
  // Pre-numbering guarantees uniqueness without touching history:
  //   1 file  → "bali_villa_pool.jpg"       (no suffix — clean single-file download)
  //   N files → "bali_villa_pool_01.jpg", "bali_villa_pool_02.jpg", ...
  const numberedBasenames = selectedUrls.map((_, i) =>
    selectedUrls.length === 1
      ? basename
      : `${basename}_${String(i + 1).padStart(2, '0')}`,
  );

  const results = await Promise.allSettled(
    selectedUrls.map(async (url, i) => {
      // Derive extension from the ORIGINAL URL (before CDN rewrite) so the
      // file extension comes from the actual image filename, not CDN transform params
      const ext = deriveExt(url);
      const upscaledUrl = rewriteUrlForMaxResolution(url);

      if (upscaledUrl === url) {
        // No rewrite applied -- download directly
        await sendDownloadMessage(url, numberedBasenames[i], ext);
      } else {
        // CDN rewrite applied -- try upscaled URL first, fall back to original
        try {
          await sendDownloadMessage(upscaledUrl, numberedBasenames[i], ext);
        } catch {
          // Rewritten URL failed (404 or network error) -- silently try original.
          // If this also throws, Promise.allSettled catches it as 1 rejection.
          await sendDownloadMessage(url, numberedBasenames[i], ext);
        }
      }

      // Increment progress count after each successful download (or successful fallback)
      dispatch({ type: 'DOWNLOAD_PROGRESS', done: ++done });
    }),
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  const saved = selectedUrls.length - failed;
  dispatch({ type: 'DOWNLOAD_DONE', saved, failed });

  // Persist last-used field values and the current tab's hostname.
  // The hostname is used on next mount to decide whether to restore these values
  // (same site → restore, different site → start fresh).
  if (saved > 0) {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const hostname = tabs[0]?.url ? new URL(tabs[0].url).hostname : '';
      chrome.storage.local.set({
        destination: state.destination,
        vendor: state.vendor,
        category: state.category,
        lastHostname: hostname,
      });
    });
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

interface ThumbnailCardProps {
  image: ImageResult;
  selected: boolean;
  onToggle: (url: string) => void;
}

/**
 * Single image tile in the grid.
 * Shows a blue ring and checkmark overlay when selected.
 * Uses aria-pressed for screen reader accessibility.
 * Keyed by image.url (NOT by array index) to prevent re-render flicker
 * when new images stream in via IMAGE_FOUND.
 */
function ThumbnailCard({ image, selected, onToggle }: ThumbnailCardProps) {
  return (
    <button
      onClick={() => onToggle(image.url)}
      aria-pressed={selected}
      className={[
        'relative rounded overflow-hidden bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
        selected ? 'ring-2 ring-blue-600' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img
        src={image.url}
        alt=""
        className="w-full h-20 object-cover"
        // On load error: hide the broken image and show a gray placeholder
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const placeholder = img.nextElementSibling as HTMLElement | null;
          if (placeholder) placeholder.style.display = 'flex';
        }}
      />
      {/* Gray placeholder shown when image fails to load */}
      <div
        className="hidden w-full h-20 bg-gray-200 items-center justify-center text-gray-400 text-lg"
        aria-hidden="true"
      >
        ?
      </div>
      {/* Blue checkmark overlay shown when selected */}
      {selected && (
        <span
          className="absolute inset-0 flex items-center justify-center bg-blue-600/20 text-blue-600 text-lg font-bold"
          aria-hidden="true"
        >
          ✓
        </span>
      )}
    </button>
  );
}

interface ThumbnailGridProps {
  scanStatus: ScanStatus;
  images: ImageResult[];
  selected: Set<string>;
  onToggle: (url: string) => void;
}

/**
 * 3-column grid of thumbnail images.
 * Shows loading skeletons while scanning, empty state when done with 0 images,
 * timeout state, or the actual grid of ThumbnailCard components.
 */
function ThumbnailGrid({ scanStatus, images, selected, onToggle }: ThumbnailGridProps) {
  // Loading skeleton: 9 gray animated placeholder tiles while scanning
  if (scanStatus === 'scanning') {
    return (
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-[13px] text-gray-500 mb-2 px-1">Scanning page...</p>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-200 animate-pulse rounded h-20"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  // Timeout state: content script didn't respond within 5 seconds
  if (scanStatus === 'timeout') {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
        <p className="text-[15px] font-semibold text-gray-700 mb-1">No photos found</p>
        <p className="text-[13px] text-gray-500">
          The page scan timed out. Try scrolling to load more images, then scan again.
        </p>
      </div>
    );
  }

  // Empty state: scan completed but found no images
  if (scanStatus === 'done' && images.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
        <p className="text-[15px] font-semibold text-gray-700 mb-1">No photos found</p>
        <p className="text-[13px] text-gray-500">
          This page doesn&apos;t have any extractable images. Try scrolling to load more, then
          reopen the extension.
        </p>
      </div>
    );
  }

  // Idle state: prompt to scan
  if (scanStatus === 'idle') {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
        <p className="text-[13px] text-gray-400">Click &quot;Scan Page&quot; to find images.</p>
      </div>
    );
  }

  // Populated state: show all found images in a 3-column grid
  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="grid grid-cols-3 gap-1">
        {images.map((image) => (
          // Key by URL, not index — prevents flicker when images stream in via IMAGE_FOUND
          <ThumbnailCard
            key={image.url}
            image={image}
            selected={selected.has(image.url)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

interface SelectionBarProps {
  images: ImageResult[];
  selected: Set<string>;
  onSelectAll: () => void;
  onClearAll: () => void;
}

/**
 * Row showing selection count and a Select All / Clear All toggle.
 * The button label changes based on whether all images are selected.
 */
function SelectionBar({ images, selected, onSelectAll, onClearAll }: SelectionBarProps) {
  const allSelected = images.length > 0 && selected.size === images.length;

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-[13px] text-gray-600">{selected.size} selected</span>
      <button
        onClick={allSelected ? onClearAll : onSelectAll}
        className="text-[13px] text-blue-600 hover:underline"
      >
        {allSelected ? 'Clear All' : 'Select All'}
      </button>
    </div>
  );
}

interface NamingFormProps {
  destination: string;
  vendor: string;
  category: string;
  notes: string;
  onChange: (field: 'destination' | 'vendor' | 'category' | 'notes', value: string) => void;
}

/**
 * Four text fields: Destination, Property/Vendor, Category (with datalist presets),
 * and Notes (optional). Labels are real <label> elements for accessibility —
 * placeholders alone are not sufficient for screen readers.
 */
function NamingForm({ destination, vendor, category, notes, onChange }: NamingFormProps) {
  const inputClass =
    'w-full px-2 py-2 text-[13px] bg-gray-100 rounded border-0 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'text-xs text-gray-600';

  return (
    <div className="px-4 pb-3 space-y-2">
      {/* Destination */}
      <div>
        <label htmlFor="field-destination" className={labelClass}>
          Destination
        </label>
        <input
          id="field-destination"
          type="text"
          value={destination}
          placeholder="e.g. bali"
          onChange={(e) => onChange('destination', e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Property / Vendor */}
      <div>
        <label htmlFor="field-vendor" className={labelClass}>
          Property / Vendor
        </label>
        <input
          id="field-vendor"
          type="text"
          value={vendor}
          placeholder="e.g. four-seasons"
          onChange={(e) => onChange('vendor', e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Category — free text with datalist suggestions */}
      <div>
        <label htmlFor="field-category" className={labelClass}>
          Category
        </label>
        <input
          id="field-category"
          type="text"
          value={category}
          placeholder="e.g. pool, room, excursion"
          list="category-presets"
          onChange={(e) => onChange('category', e.target.value)}
          className={inputClass}
        />
        {/* Non-binding preset suggestions — Jennifer can type any value */}
        <datalist id="category-presets">
          <option value="room" />
          <option value="pool" />
          <option value="lobby" />
          <option value="exterior" />
          <option value="food" />
          <option value="excursion" />
          <option value="beach" />
          <option value="spa" />
          <option value="activities" />
        </datalist>
      </div>

      {/* Notes — optional, not required for download */}
      <div>
        <label htmlFor="field-notes" className={labelClass}>
          Notes (optional)
        </label>
        <input
          id="field-notes"
          type="text"
          value={notes}
          placeholder="e.g. lobby, beachfront"
          onChange={(e) => onChange('notes', e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}

interface DownloadButtonProps {
  selected: Set<string>;
  destination: string;
  vendor: string;
  category: string;
  notes: string;
  downloadStatus: DownloadStatus;
  images: ImageResult[];
  state: PopupState;
  dispatch: React.Dispatch<Action>;
}

/**
 * Primary CTA button. Disabled until at least 1 image is selected AND all
 * three required fields have non-whitespace content (uses .trim() check — plain
 * .length > 0 would allow whitespace-only strings that produce malformed filenames).
 */
function DownloadButton({
  selected,
  destination,
  vendor,
  category,
  notes,
  downloadStatus,
  images: _images,
  state,
  dispatch,
}: DownloadButtonProps) {
  const count = selected.size;

  // All three required fields must have real content (not just spaces)
  const fieldsValid =
    destination.trim().length > 0 &&
    vendor.trim().length > 0 &&
    category.trim().length > 0;

  const isEnabled = count > 0 && fieldsValid && downloadStatus !== 'downloading';

  // Button label follows the copywriting contract exactly
  let label: string;
  if (downloadStatus === 'downloading') {
    label = 'Downloading...';
  } else if (count === 0 || !fieldsValid) {
    label = 'Download Photos';
  } else if (count === 1) {
    label = 'Download 1 Photo';
  } else {
    label = `Download ${count} Photos`;
  }

  const handleClick = () => {
    if (!isEnabled) return;
    const basename = buildBasename(destination, vendor, category, notes);
    const selectedUrls = Array.from(selected);
    runDownloads(selectedUrls, basename, state, dispatch);
  };

  return (
    <div className="px-4 pb-2">
      <button
        onClick={handleClick}
        disabled={!isEnabled}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-medium"
      >
        {label}
      </button>
    </div>
  );
}

interface StatusMessageProps {
  downloadStatus: DownloadStatus;
  downloadProgress: { done: number; total: number };
  downloadSaved: number;
  downloadFailed: number;
}

/**
 * Inline status feedback shown below the download button.
 * Covers all four outcomes: in-progress, success, partial failure, full failure.
 * Copy follows the copywriting contract in UI-SPEC exactly.
 */
function StatusMessage({
  downloadStatus,
  downloadProgress,
  downloadSaved,
  downloadFailed,
}: StatusMessageProps) {
  if (downloadStatus === 'idle') return null;

  let message: string;
  let colorClass: string;

  if (downloadStatus === 'downloading') {
    message = `Saving ${downloadProgress.done} of ${downloadProgress.total}...`;
    colorClass = 'text-gray-600';
  } else if (downloadStatus === 'success') {
    // Singular for 1 photo, plural for N
    const photoWord = downloadSaved === 1 ? 'photo' : 'photos';
    message = `Saved ${downloadSaved} ${photoWord} to Downloads/travel-photos/`;
    colorClass = 'text-gray-600';
  } else if (downloadStatus === 'partial') {
    // Use em dash character as specified in the UI-SPEC copywriting contract
    message = `Saved ${downloadSaved} of ${downloadSaved + downloadFailed} photos \u2014 ${downloadFailed} failed to download.`;
    colorClass = 'text-red-600';
  } else {
    // 'error' — all downloads failed
    message = 'Download failed. Check your internet connection and try again.';
    colorClass = 'text-red-600';
  }

  return (
    <p className={`text-[13px] mt-2 px-4 pb-3 ${colorClass}`}>{message}</p>
  );
}

interface PopupHeaderProps {
  scanStatus: ScanStatus;
  imageCount: number;
  blobCount: number;
  onScan: () => void;
}

/**
 * Fixed header showing the extension name, image count badge, and Scan Page button.
 * The Scan Page button is visible in idle, done, and timeout states — Jennifer can
 * rescan if she navigates to new content or wants a fresh result.
 */
function PopupHeader({ scanStatus, imageCount, blobCount, onScan }: PopupHeaderProps) {
  const showScanButton = scanStatus === 'idle' || scanStatus === 'done' || scanStatus === 'timeout';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
      <div>
        <h1 className="text-[15px] font-semibold text-gray-900">Photo Extractor</h1>
        {/* Show image count once scan has results */}
        {scanStatus === 'done' && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[11px] font-semibold text-gray-500">
              {imageCount} {imageCount === 1 ? 'image' : 'images'} found
            </span>
            {/* Blob URL notice: some images are served as blob: URLs and cannot be captured */}
            {blobCount > 0 && (
              <span className="text-[11px] text-gray-400">
                ({blobCount} blob {blobCount === 1 ? 'image' : 'images'} could not be captured)
              </span>
            )}
          </div>
        )}
      </div>
      {showScanButton && (
        <button
          onClick={onScan}
          className="text-[13px] text-blue-600 hover:underline font-medium"
        >
          Scan Page
        </button>
      )}
    </div>
  );
}

// ─── App (Main Component) ─────────────────────────────────────────────────────

/**
 * Root popup component. Mounts useReducer, wires all child components,
 * and handles the two side effects:
 *   1. Pre-fill on mount — reads chrome.storage.local for last-used values
 *   2. Scan port — opened by "Scan Page" button click (not on mount)
 */
export default function App() {
  const [state, dispatch] = useReducer(popupReducer, initialState);

  // Pre-fill form fields from last-used values stored in chrome.storage.local,
  // but only if the current tab's hostname matches where those values were saved.
  // This way, browsing multiple listings on the same site carries fields over,
  // but navigating to a new site starts fresh instead of showing stale values.
  useEffect(() => {
    Promise.all([
      chrome.storage.local.get(['destination', 'vendor', 'category', 'lastHostname']),
      chrome.tabs.query({ active: true, currentWindow: true }),
    ]).then(([data, tabs]) => {
      const currentHostname = tabs[0]?.url ? new URL(tabs[0].url).hostname : null;
      const storedHostname = data.lastHostname as string | undefined;

      // Only restore if we're on the same site as the last save
      if (currentHostname && storedHostname && currentHostname === storedHostname) {
        dispatch({
          type: 'PREFILL_LOADED',
          destination: (data.destination as string) ?? '',
          vendor: (data.vendor as string) ?? '',
          category: (data.category as string) ?? '',
        });
      }
    });
  }, []);

  const handleScan = () => {
    startScan(dispatch);
  };

  const handleToggle = (url: string) => {
    dispatch({ type: 'TOGGLE_SELECT', url });
  };

  const handleSelectAll = () => {
    dispatch({ type: 'SELECT_ALL' });
  };

  const handleClearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
  };

  const handleFieldChange = (
    field: 'destination' | 'vendor' | 'category' | 'notes',
    value: string,
  ) => {
    dispatch({ type: 'FIELD_CHANGE', field, value });
  };

  const showBottomSection =
    state.scanStatus === 'done' && state.images.length > 0;

  return (
    // Fixed 360px width per UI-SPEC. maxHeight 600px is Chrome's popup viewport limit.
    <div className="w-[360px] flex flex-col" style={{ maxHeight: '600px' }}>
      <PopupHeader
        scanStatus={state.scanStatus}
        imageCount={state.images.length}
        blobCount={state.blobCount}
        onScan={handleScan}
      />

      {/* Scrollable thumbnail grid — fills remaining vertical space */}
      <ThumbnailGrid
        scanStatus={state.scanStatus}
        images={state.images}
        selected={state.selected}
        onToggle={handleToggle}
      />

      {/* Sticky bottom section: selection bar, naming form, download button */}
      {showBottomSection && (
        <div className="border-t bg-white">
          <SelectionBar
            images={state.images}
            selected={state.selected}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
          />
          <NamingForm
            destination={state.destination}
            vendor={state.vendor}
            category={state.category}
            notes={state.notes}
            onChange={handleFieldChange}
          />
          <DownloadButton
            selected={state.selected}
            destination={state.destination}
            vendor={state.vendor}
            category={state.category}
            notes={state.notes}
            downloadStatus={state.downloadStatus}
            images={state.images}
            state={state}
            dispatch={dispatch}
          />
          <StatusMessage
            downloadStatus={state.downloadStatus}
            downloadProgress={state.downloadProgress}
            downloadSaved={state.downloadSaved}
            downloadFailed={state.downloadFailed}
          />
        </div>
      )}
    </div>
  );
}
