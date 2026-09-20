/**
 * Browser I/O for export and import. Share sheet where the phone has
 * one, file download otherwise; file picker text for import.
 */
import type { ExportFile } from '../storage';

export async function shareOrDownload(file: ExportFile): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([file.markdown], { type: 'text/markdown' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof File !== 'undefined' && nav.share && nav.canShare) {
    const f = new File([blob], file.filename, { type: 'text/markdown' });
    const data: ShareData = { files: [f], title: file.filename };
    if (nav.canShare(data)) {
      try {
        await nav.share(data);
        return 'shared';
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
        // fall through to download
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export function readTextFile(file: File): Promise<string> {
  return file.text();
}
