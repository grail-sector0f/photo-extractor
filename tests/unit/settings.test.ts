// Unit tests for lib/settings.ts — the settings data layer.
// Tests cover: type shape, default values, load/save helpers, merge behavior.
// The chrome.storage.local mock from tests/setup.ts is available globally.

import { chromeMock } from '../setup';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  MIN_DIMENSION_PRESETS,
  loadSettings,
  saveSettings,
} from '@/lib/settings';

describe('AppSettings type and DEFAULT_SETTINGS', () => {
  it('DEFAULT_SETTINGS has minDimension of 150 (Medium preset)', () => {
    expect(DEFAULT_SETTINGS.minDimension).toBe(150);
  });

  it('DEFAULT_SETTINGS has skipGifs of false (off by default)', () => {
    expect(DEFAULT_SETTINGS.skipGifs).toBe(false);
  });

  it('DEFAULT_SETTINGS has cdnUpscalingEnabled of true (on by default)', () => {
    expect(DEFAULT_SETTINGS.cdnUpscalingEnabled).toBe(true);
  });

  it('DEFAULT_SETTINGS has exactly the three expected keys', () => {
    const keys = Object.keys(DEFAULT_SETTINGS).sort();
    expect(keys).toEqual(['cdnUpscalingEnabled', 'minDimension', 'skipGifs']);
  });
});

describe('MIN_DIMENSION_PRESETS', () => {
  it('exports three presets', () => {
    expect(MIN_DIMENSION_PRESETS).toHaveLength(3);
  });

  it('first preset is Small at 50', () => {
    expect(MIN_DIMENSION_PRESETS[0]).toEqual({ label: 'Small', value: 50 });
  });

  it('second preset is Medium at 150 (matches DEFAULT_SETTINGS.minDimension)', () => {
    expect(MIN_DIMENSION_PRESETS[1]).toEqual({ label: 'Medium', value: 150 });
  });

  it('third preset is Large at 300', () => {
    expect(MIN_DIMENSION_PRESETS[2]).toEqual({ label: 'Large', value: 300 });
  });
});

describe('loadSettings', () => {
  it('returns DEFAULT_SETTINGS when storage has no settings key', async () => {
    // chrome.storage.local.get returns empty object — nothing stored yet
    chromeMock.storage.local.get.mockResolvedValue({});

    const result = await loadSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored partial settings over defaults (custom minDimension)', async () => {
    // Only minDimension is stored — other fields should fall back to defaults
    chromeMock.storage.local.get.mockResolvedValue({ settings: { minDimension: 300 } });

    const result = await loadSettings();

    expect(result.minDimension).toBe(300);
    expect(result.skipGifs).toBe(DEFAULT_SETTINGS.skipGifs);
    expect(result.cdnUpscalingEnabled).toBe(DEFAULT_SETTINGS.cdnUpscalingEnabled);
  });

  it('merges stored partial settings over defaults (custom skipGifs)', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ settings: { skipGifs: true } });

    const result = await loadSettings();

    expect(result.skipGifs).toBe(true);
    expect(result.minDimension).toBe(DEFAULT_SETTINGS.minDimension);
    expect(result.cdnUpscalingEnabled).toBe(DEFAULT_SETTINGS.cdnUpscalingEnabled);
  });

  it('merges stored partial settings over defaults (custom cdnUpscalingEnabled)', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ settings: { cdnUpscalingEnabled: false } });

    const result = await loadSettings();

    expect(result.cdnUpscalingEnabled).toBe(false);
    expect(result.minDimension).toBe(DEFAULT_SETTINGS.minDimension);
    expect(result.skipGifs).toBe(DEFAULT_SETTINGS.skipGifs);
  });

  it('returns fully stored settings when all fields are present', async () => {
    const stored: AppSettings = { minDimension: 50, skipGifs: true, cdnUpscalingEnabled: false };
    chromeMock.storage.local.get.mockResolvedValue({ settings: stored });

    const result = await loadSettings();

    expect(result).toEqual(stored);
  });

  it('calls chrome.storage.local.get with the settings key', async () => {
    chromeMock.storage.local.get.mockResolvedValue({});

    await loadSettings();

    expect(chromeMock.storage.local.get).toHaveBeenCalledWith('settings');
  });
});

describe('saveSettings', () => {
  it('calls chrome.storage.local.set with { settings: <provided object> }', async () => {
    const settings: AppSettings = { minDimension: 300, skipGifs: true, cdnUpscalingEnabled: false };

    await saveSettings(settings);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ settings });
  });

  it('persists DEFAULT_SETTINGS when called with defaults', async () => {
    await saveSettings(DEFAULT_SETTINGS);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ settings: DEFAULT_SETTINGS });
  });
});
