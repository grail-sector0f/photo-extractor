/**
 * settings.ts — App settings: types, defaults, and chrome.storage persistence helpers.
 *
 * This module is the single source of truth for all user-configurable settings.
 * It is a pure dependency — importing it has no side effects.
 *
 * Plan 02 will build the settings UI on top of these helpers. The content script
 * and popup read from this module to apply settings at scan and download time.
 *
 * Settings are persisted under the 'settings' key in chrome.storage.local.
 * Any missing keys are merged with DEFAULT_SETTINGS at load time, so partial
 * stored objects are safe and future fields added to the type will degrade gracefully.
 */

/**
 * The full set of user-configurable app settings.
 *
 * - minDimension: Minimum pixel dimension (width or height) for images to be
 *   included in scan results. Images smaller than this threshold are filtered out.
 * - skipGifs: When true, .gif URLs are excluded from scan results entirely.
 *   Useful for filtering out decorative animations and UI icons.
 * - cdnUpscalingEnabled: When true, CDN image URLs are rewritten at download
 *   time to request the highest available resolution. When false, the original
 *   URL is used as-is.
 */
export interface AppSettings {
  minDimension: number;
  skipGifs: boolean;
  cdnUpscalingEnabled: boolean;
}

/**
 * Preset options for the minDimension setting.
 * Displayed as buttons in the settings UI rather than a free-form input or slider.
 *
 * Rationale for preset values (per user decision):
 *   - Small (50px): Catches thumbnails and icons; may include some UI images
 *   - Medium (150px): Balanced default — captures most content images, skips small icons
 *   - Large (300px): Only large hero/content images; skips thumbnails
 *
 * `as const` makes the array and its element shapes readonly/literal-typed.
 */
export const MIN_DIMENSION_PRESETS = [
  { label: 'Small', value: 50 },
  { label: 'Medium', value: 150 },
  { label: 'Large', value: 300 },
] as const;

/**
 * Default settings applied when no stored settings exist,
 * or to fill in any keys missing from a partial stored object.
 *
 * Per user decisions:
 *   - minDimension: 150 (Medium preset — balanced starting point)
 *   - skipGifs: false (show all images including GIFs by default)
 *   - cdnUpscalingEnabled: true (upscale CDN images by default for quality)
 */
export const DEFAULT_SETTINGS: AppSettings = {
  minDimension: 150,
  skipGifs: false,
  cdnUpscalingEnabled: true,
};

/**
 * Load settings from chrome.storage.local, merging over DEFAULT_SETTINGS.
 *
 * If no settings have been saved yet (first run), returns DEFAULT_SETTINGS.
 * If partial settings are stored (e.g., only minDimension), the missing fields
 * are filled in from DEFAULT_SETTINGS. This makes adding new settings fields
 * safe without requiring a migration step.
 *
 * @returns Promise resolving to the full AppSettings object
 */
export async function loadSettings(): Promise<AppSettings> {
  // Fetch the stored settings object (or undefined if never saved)
  const data = await chrome.storage.local.get('settings');

  // Merge: stored values override defaults, missing keys fall back to defaults
  return { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
}

/**
 * Save settings to chrome.storage.local under the 'settings' key.
 *
 * Always saves the full AppSettings object (not a partial). The popup
 * reads back via loadSettings() which merges anyway, but storing the full
 * object keeps the stored state self-consistent and easy to inspect.
 *
 * @param settings - The full AppSettings object to persist
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.local.set({ settings });
}
