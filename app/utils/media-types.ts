/**
 * Shared media type detection utilities.
 * Used by files store, workbench store, chat, and CodeMirror editor
 * to consistently detect binary/media files by extension.
 */

/**
 * All known binary/media file extensions.
 * Files with these extensions should be treated as binary in the editor
 * and displayed with MediaPreview instead of CodeMirror.
 */
export const MEDIA_EXTENSIONS = [
  // Images
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'tiff', 'tif',
  // Video
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v',
  // Audio
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'wma', 'opus',
  // Fonts
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  // Other binary formats
  'zip', 'gz', 'tar', 'rar', '7z', 'pdf', 'wasm',
] as const;

/**
 * Image extensions specifically (for MediaPreview image rendering)
 */
export const IMAGE_EXTENSIONS = [
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'tiff', 'tif',
] as const;

/**
 * Video extensions specifically (for MediaPreview video rendering)
 */
export const VIDEO_EXTENSIONS = [
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v',
] as const;

/**
 * Audio extensions specifically (for MediaPreview audio rendering)
 */
export const AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'wma', 'opus',
] as const;

/**
 * Check if a file path has a known media/binary extension.
 */
export function isMediaExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return (MEDIA_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Check if a file path has an image extension.
 */
export function isImageExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Check if a file path has a video extension.
 */
export function isVideoExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Check if a file path has an audio extension.
 */
export function isAudioExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}
