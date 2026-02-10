/**
 * Utility for opening files in slicer applications
 *
 * Bambu Studio URL protocol is OS-specific:
 * - Windows: bambustudio://<encoded-URL>
 * - macOS/Linux: bambustudioopen://<encoded-URL>
 *
 * OrcaSlicer uses the same protocol on all platforms:
 * - orcaslicer://open?file=<URL>
 */

export type SlicerType = 'bambu_studio' | 'orcaslicer';

type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

/**
 * Detect the user's operating system
 */
export function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';

  if (userAgent.includes('win') || platform.includes('win')) {
    return 'windows';
  }
  if (userAgent.includes('mac') || platform.includes('mac')) {
    return 'macos';
  }
  if (userAgent.includes('linux') || platform.includes('linux')) {
    return 'linux';
  }
  return 'unknown';
}

/**
 * Open a URL in the specified slicer application.
 * Uses a temporary link element to trigger the protocol handler,
 * which avoids browser "unknown protocol" blocks on window.location.href.
 * @param downloadUrl - The URL to the file to open
 * @param slicer - Which slicer to use (defaults to bambu_studio)
 */
export function openInSlicer(downloadUrl: string, slicer: SlicerType = 'bambu_studio'): void {
  let url: string;

  if (slicer === 'orcaslicer') {
    url = `orcaslicer://open?file=${downloadUrl}`;
  } else {
    const platform = detectPlatform();
    const protocol = platform === 'windows' ? 'bambustudio' : 'bambustudioopen';
    url = `${protocol}://${encodeURIComponent(downloadUrl)}`;
  }

  // Use a temporary <a> element to trigger the protocol handler.
  // This works more reliably than window.location.href for custom protocols.
  const link = document.createElement('a');
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Build a full download URL for a file
 * @param path - The API path (e.g., from api.getArchiveForSlicer())
 */
export function buildDownloadUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

/**
 * Convenience function to open an archive in the slicer
 * @param path - The API path to the archive
 * @param slicer - Which slicer to use (defaults to bambu_studio)
 */
export function openArchiveInSlicer(path: string, slicer: SlicerType = 'bambu_studio'): void {
  const downloadUrl = buildDownloadUrl(path);
  openInSlicer(downloadUrl, slicer);
}
