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
 *   - Pre-fill: chrome.storage.local persists the last-used destination/vendor/category/year
 *     and restores them on mount.
 *
 * Visual design: Material Design 3 color tokens (defined in tailwind.config.js),
 * Manrope + Inter fonts (bundled WOFF2 in public/fonts/), inline SVG icons
 * (Google Fonts CDN is inaccessible inside extension popups).
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
  // Year field — defaults to current year, persisted to chrome.storage.local
  year: string;
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
  | { type: 'FIELD_CHANGE'; field: 'destination' | 'vendor' | 'category' | 'year' | 'notes'; value: string }
  | { type: 'DOWNLOAD_STARTED'; total: number }
  | { type: 'DOWNLOAD_PROGRESS'; done: number }
  | { type: 'DOWNLOAD_DONE'; saved: number; failed: number }
  | { type: 'PREFILL_LOADED'; destination: string; vendor: string; category: string; year: string };

// ─── Initial State ────────────────────────────────────────────────────────────

export const initialState: PopupState = {
  scanStatus: 'idle',
  images: [],
  blobCount: 0,
  selected: new Set(),
  destination: '',
  vendor: '',
  category: '',
  year: String(new Date().getFullYear()),
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
      // into the new scan. Form fields (destination/vendor/category/year/notes) are
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
        year: action.year,
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
 * After completion, persists destination/vendor/category/year to chrome.storage.local
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

  // Persist last-used field values (including year) and the current tab's hostname.
  // The hostname is used on next mount to decide whether to restore these values
  // (same site → restore, different site → start fresh).
  if (saved > 0) {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const hostname = tabs[0]?.url ? new URL(tabs[0].url).hostname : '';
      chrome.storage.local.set({
        destination: state.destination,
        vendor: state.vendor,
        category: state.category,
        year: state.year,
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
 * Selected state: blue ring (ring-2 ring-primary) + blue tint overlay + green checkmark badge.
 * Unselected state: slightly dimmed (opacity-80) with full opacity on hover.
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
        'relative rounded overflow-hidden bg-surface-container focus:outline-none group',
        selected ? 'ring-2 ring-primary' : 'opacity-80 hover:opacity-100',
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
        className="hidden w-full h-20 bg-surface-container-high items-center justify-center text-on-surface-variant text-lg"
        aria-hidden="true"
      >
        ?
      </div>
      {/* MD3 selection overlay: blue tint + green checkmark badge */}
      {selected && (
        <>
          {/* Subtle blue tint over the whole tile */}
          <div className="absolute inset-0 bg-primary/10" aria-hidden="true" />
          {/* Green filled checkmark badge in top-right corner */}
          <span
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-tertiary flex items-center justify-center"
            aria-hidden="true"
          >
            {/* Checkmark path from Material Symbols */}
            <svg className="w-3 h-3 text-on-tertiary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.55 18l-5.7-5.7 1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z"/>
            </svg>
          </span>
        </>
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
        <p className="text-[13px] text-on-surface-variant mb-2 px-1">Scanning page...</p>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-container animate-pulse rounded h-20"
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
        <p className="text-[15px] font-semibold text-on-surface mb-1">No photos found</p>
        <p className="text-[13px] text-on-surface-variant">
          The page scan timed out. Try scrolling to load more images, then scan again.
        </p>
      </div>
    );
  }

  // Empty state: scan completed but found no images
  if (scanStatus === 'done' && images.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
        <p className="text-[15px] font-semibold text-on-surface mb-1">No photos found</p>
        <p className="text-[13px] text-on-surface-variant">
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
        <p className="text-[13px] text-on-surface-variant">Click &quot;Scan Page&quot; to find images.</p>
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

interface GalleryHeaderProps {
  images: ImageResult[];
  onSelectAll: () => void;
  onClearAll: () => void;
}

/**
 * Row above the thumbnail grid showing photo count badge, "Gallery" heading,
 * and separate "Select All" / "Clear All" action links.
 * Replaces the old SelectionBar component (which showed "N selected" + a single toggle).
 */
function GalleryHeader({ images, onSelectAll, onClearAll }: GalleryHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        {/* Count badge — uses secondary-fixed surface so it reads as a quiet label */}
        <span className="px-2 py-0.5 text-xs font-semibold bg-secondary-fixed text-on-secondary-container rounded-full">
          {images.length}
        </span>
        <h2 className="text-lg font-extrabold font-manrope text-on-surface">Gallery</h2>
      </div>
      {/* Two separate action links instead of a single toggle */}
      <div className="flex gap-3">
        <button onClick={onSelectAll} className="text-sm text-primary hover:underline">
          Select All
        </button>
        <button onClick={onClearAll} className="text-sm text-on-surface-variant hover:underline">
          Clear All
        </button>
      </div>
    </div>
  );
}

interface NamingFormProps {
  destination: string;
  vendor: string;
  category: string;
  year: string;
  notes: string;
  onChange: (field: 'destination' | 'vendor' | 'category' | 'year' | 'notes', value: string) => void;
}

/**
 * Metadata form wrapped in an MD3 surface-container-low card.
 * Fields: Destination, Property/Vendor, Category (select) + Year (number) side-by-side, Notes (textarea).
 * Labels are real <label> elements for accessibility.
 * Category is a locked <select> dropdown (not free-text) with 4 preset options.
 * Year defaults to current year and persists to storage alongside other fields.
 */
function NamingForm({ destination, vendor, category, year, notes, onChange }: NamingFormProps) {
  // MD3-styled input: white fill (surface-container-lowest), no visible border, focus ring
  const inputClass =
    'w-full bg-surface-container-lowest border-none rounded-lg p-3 text-sm font-inter text-on-surface focus:ring-2 focus:ring-primary/40 focus:outline-none';
  const labelClass = 'text-xs font-medium font-inter text-on-surface-variant mb-1 block';

  return (
    // Card wrapper — light gray background that lifts the form off the white page surface
    <div className="mx-4 my-3 bg-surface-container-low p-5 rounded-xl">
      {/* Section label — uppercase tracking gives it a quiet "label" treatment */}
      <p className="text-[10px] font-semibold tracking-widest text-on-surface-variant uppercase mb-3">
        Metadata Assignment
      </p>

      {/* Destination */}
      <div className="mb-3">
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
      <div className="mb-3">
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

      {/* Category + Year — side by side in a 2-column grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Category — locked select dropdown (no free-text entry) */}
        <div>
          <label htmlFor="field-category" className={labelClass}>
            Category
          </label>
          <select
            id="field-category"
            value={category}
            onChange={(e) => onChange('category', e.target.value)}
            className={`${inputClass} appearance-none`}
          >
            <option value="">Select...</option>
            <option value="landscape">Landscape</option>
            <option value="accommodation">Accommodation</option>
            <option value="dining">Dining</option>
            <option value="activities">Activities</option>
          </select>
        </div>

        {/* Year — number input, min/max bounded, defaults to current year */}
        <div>
          <label htmlFor="field-year" className={labelClass}>
            Year
          </label>
          <input
            id="field-year"
            type="number"
            value={year}
            min="2000"
            max="2099"
            onChange={(e) => onChange('year', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Notes — textarea replaces the previous single-line input */}
      <div>
        <label htmlFor="field-notes" className={labelClass}>
          Notes (optional)
        </label>
        <textarea
          id="field-notes"
          rows={2}
          value={notes}
          placeholder="Add a description for the advisor..."
          onChange={(e) => onChange('notes', e.target.value)}
          className={`${inputClass} resize-none`}
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
  year: string;
  notes: string;
  downloadStatus: DownloadStatus;
  images: ImageResult[];
  state: PopupState;
  dispatch: React.Dispatch<Action>;
}

/**
 * Sticky download footer with gradient fade.
 * Button is full-width, MD3 primary-container styling, Manrope extrabold.
 * Disabled until at least 1 image is selected AND all three required fields
 * have non-whitespace content. Year is not required for download — only destination,
 * vendor, and category are required.
 */
function DownloadButton({
  selected,
  destination,
  vendor,
  category,
  year,
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
    // Pass year as the 4th argument — inserted between category and notes
    const basename = buildBasename(destination, vendor, category, year, notes);
    const selectedUrls = Array.from(selected);
    runDownloads(selectedUrls, basename, state, dispatch);
  };

  return (
    // Gradient fade from solid white (surface) to transparent — creates a "floating" button effect
    <div className="sticky bottom-0 bg-gradient-to-t from-surface via-surface to-transparent pt-8 px-4 pb-4">
      <button
        onClick={handleClick}
        disabled={!isEnabled}
        className="w-full bg-primary-container text-on-primary-container font-manrope font-extrabold py-4 rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
      >
        {/* Download icon — Material Symbols download path */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 16l-5-5 1.4-1.45 2.6 2.6V4h2v8.15l2.6-2.6L17 11l-5 5Zm-6 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20H6Z"/>
        </svg>
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
    colorClass = 'text-on-surface-variant';
  } else if (downloadStatus === 'success') {
    // Singular for 1 photo, plural for N
    const photoWord = downloadSaved === 1 ? 'photo' : 'photos';
    message = `Saved ${downloadSaved} ${photoWord} to Downloads/travel-photos/`;
    colorClass = 'text-on-surface-variant';
  } else if (downloadStatus === 'partial') {
    // Use em dash character as specified in the UI-SPEC copywriting contract
    message = `Saved ${downloadSaved} of ${downloadSaved + downloadFailed} photos \u2014 ${downloadFailed} failed to download.`;
    colorClass = 'text-error';
  } else {
    // 'error' — all downloads failed
    message = 'Download failed. Check your internet connection and try again.';
    colorClass = 'text-error';
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
 * Sticky header with backdrop blur — floats above content while scrolling.
 * Left: camera SVG icon + "Photo Extractor" in Manrope bold.
 * Right: "Scan Page" button with MD3 primary-container styling.
 *
 * Google Fonts CDN is inaccessible inside extension popups, so Material Symbols
 * web font cannot be used. Inline SVG paths from Material Symbols are used instead.
 *
 * The Scan Page button is visible in idle, done, and timeout states — Jennifer can
 * rescan if she navigates to new content or wants a fresh result.
 */
function PopupHeader({ scanStatus, imageCount: _imageCount, blobCount: _blobCount, onScan }: PopupHeaderProps) {
  const showScanButton = scanStatus === 'idle' || scanStatus === 'done' || scanStatus === 'timeout';

  return (
    <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-md shadow-sm shadow-slate-200/50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Camera icon — SVG path from Material Symbols camera_enhance */}
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17.5q2.08 0 3.54-1.46T17 12.5q0-2.08-1.46-3.54T12 7.5q-2.08 0-3.54 1.46T7 12.5q0 2.08 1.46 3.54T12 17.5Zm0-2q-1.25 0-2.125-.875T9 12.5q0-1.25.875-2.125T12 9.5q1.25 0 2.125.875T15 12.5q0 1.25-.875 2.125T12 15.5ZM4 21q-.825 0-1.412-.587T2 19V6q0-.825.587-1.412T4 4h3.15L9 2h6l1.85 2H20q.825 0 1.413.587T22 6v13q0 .825-.587 1.413T20 21H4Z"/>
          </svg>
          <h1 className="text-base font-bold font-manrope text-on-surface">Photo Extractor</h1>
        </div>
        {showScanButton && (
          <button
            onClick={onScan}
            className="px-4 py-1.5 text-sm font-medium bg-primary-container text-on-primary-container rounded-lg hover:opacity-90 transition-opacity"
          >
            Scan Page
          </button>
        )}
      </div>
    </div>
  );
}

// ─── App (Main Component) ─────────────────────────────────────────────────────

/**
 * Root popup component. Mounts useReducer, wires all child components,
 * and handles the two side effects:
 *   1. Pre-fill on mount — reads chrome.storage.local for last-used values
 *      (destination, vendor, category, year)
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
      chrome.storage.local.get(['destination', 'vendor', 'category', 'year', 'lastHostname']),
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
          // Fall back to current year if year wasn't previously saved
          year: (data.year as string) ?? String(new Date().getFullYear()),
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
    field: 'destination' | 'vendor' | 'category' | 'year' | 'notes',
    value: string,
  ) => {
    dispatch({ type: 'FIELD_CHANGE', field, value });
  };

  const showGallery = state.scanStatus === 'done' && state.images.length > 0;

  return (
    // Fixed 360px width per UI-SPEC. maxHeight 600px is Chrome's popup viewport limit.
    // font-inter is the default body font; Manrope is applied selectively to headings and buttons.
    <div className="w-[360px] flex flex-col font-inter" style={{ maxHeight: '600px' }}>
      {/* Sticky header: camera icon, title, and Scan Page button */}
      <PopupHeader
        scanStatus={state.scanStatus}
        imageCount={state.images.length}
        blobCount={state.blobCount}
        onScan={handleScan}
      />

      {/* Gallery header: count badge + "Gallery" heading + Select All / Clear All links */}
      {showGallery && (
        <GalleryHeader
          images={state.images}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
        />
      )}

      {/* Scrollable thumbnail grid — fills remaining vertical space */}
      <ThumbnailGrid
        scanStatus={state.scanStatus}
        images={state.images}
        selected={state.selected}
        onToggle={handleToggle}
      />

      {/* Metadata form and sticky download footer — shown when scan has results */}
      {showGallery && (
        <>
          <NamingForm
            destination={state.destination}
            vendor={state.vendor}
            category={state.category}
            year={state.year}
            notes={state.notes}
            onChange={handleFieldChange}
          />
          <DownloadButton
            selected={state.selected}
            destination={state.destination}
            vendor={state.vendor}
            category={state.category}
            year={state.year}
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
        </>
      )}
    </div>
  );
}
