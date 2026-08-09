import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Saving a generated file has to work in three quite different hosts, and the naive
// `<a download>` trick only actually works in one of them:
//   - Packaged Android app: the WebView has no download manager wired up, so an anchor click is
//     silently swallowed - the export "succeeds" and nothing is ever written anywhere the user can
//     reach it. We write to the app's cache dir and hand the file to the OS share sheet, which is
//     also where the user picks the destination ("Save to Files"/Drive/etc).
//   - Modern browsers: showSaveFilePicker gives a real "where do you want to save this?" dialog.
//   - Everything else: the classic anchor download, into the default downloads folder.

export type SaveOutcome = 'saved' | 'cancelled' | 'failed';

export function isNativeExportTarget(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Chunked so a multi-MB PDF can't blow the argument limit of String.fromCharCode(...).
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx);
}

async function saveViaNativeShare(blob: Blob, fileName: string): Promise<SaveOutcome> {
  const base64 = await blobToBase64(blob);
  const written = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  try {
    await Share.share({ url: written.uri, dialogTitle: fileName });
    return 'saved';
  } catch (shareErr) {
    // Dismissing the share sheet rejects here. The file itself was written fine, so this is a
    // user choice rather than an export failure - don't report it as an error.
    console.info('Share sheet dismissed for', fileName, shareErr);
    return 'cancelled';
  }
}

async function saveViaFilePicker(blob: Blob, fileName: string, mimeType: string): Promise<SaveOutcome | null> {
  const showSaveFilePicker = (window as any).showSaveFilePicker;
  if (typeof showSaveFilePicker !== 'function') return null;

  try {
    const handle = await showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: fileName, accept: { [mimeType]: [extensionOf(fileName)] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  } catch (err: any) {
    if (err?.name === 'AbortError') return 'cancelled';
    // Picker unavailable in this context (e.g. blocked by permissions policy in an iframe) -
    // signal "not handled" so the caller falls through to the anchor download.
    console.warn('showSaveFilePicker failed, falling back to anchor download:', err);
    return null;
  }
}

function saveViaAnchor(blob: Blob, fileName: string): SaveOutcome {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.rel = 'noopener';
    // The anchor must be in the document for the click to count in several browsers - the
    // previous detached-element version was another reason downloads could silently do nothing.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking immediately can abort the download before the browser has read the blob, so give
    // it a grace period instead.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'saved';
  } catch (err) {
    console.error('Anchor download failed:', err);
    return 'failed';
  }
}

/**
 * Persist a generated file, letting the user choose where it goes wherever the platform supports
 * that. Returns whether it was saved, deliberately cancelled by the user, or genuinely failed.
 */
export async function saveFile(blob: Blob, fileName: string, mimeType: string): Promise<SaveOutcome> {
  if (isNativeExportTarget()) {
    try {
      return await saveViaNativeShare(blob, fileName);
    } catch (err) {
      console.error('Native file save failed:', err);
      return 'failed';
    }
  }

  const pickerOutcome = await saveViaFilePicker(blob, fileName, mimeType);
  if (pickerOutcome) return pickerOutcome;

  return saveViaAnchor(blob, fileName);
}

export async function saveTextFile(content: string, fileName: string, mimeType: string): Promise<SaveOutcome> {
  return saveFile(new Blob([content], { type: mimeType }), fileName, mimeType);
}

export async function saveDataUrlFile(dataUrl: string, fileName: string, mimeType: string): Promise<SaveOutcome> {
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return saveFile(new Blob([bytes], { type: mimeType }), fileName, mimeType);
}
