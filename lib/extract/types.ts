// Shared type used by all image extraction modules.
// Both img tag and CSS background scanners return this shape so the content script
// can merge results from both sources into a single list.

export interface ImageResult {
  url: string;
  // Identifies which scanning method found this image
  sourceType: 'img' | 'css-background';
  // Present for <img> tags only — derived from img.naturalWidth/naturalHeight.
  // CSS backgrounds don't expose intrinsic dimensions, so these are undefined there.
  naturalWidth?: number;
  naturalHeight?: number;
}
