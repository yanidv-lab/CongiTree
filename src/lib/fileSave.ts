import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Inside a packaged Android app, the WebView has no OS download manager wired up, so the usual
// web trick of clicking a hidden <a download href="blob:..."> silently does nothing - the export
// functions finish and report success, but no file actually lands anywhere the user can find it.
// On native platforms we instead write the file to the app's cache dir (no storage permission
// needed) and hand it to the OS share sheet, which lets the user save it to Downloads/Drive/etc.
// or share it directly. In a real browser (web deployment), Capacitor is not "native" and callers
// should keep using the existing <a download> approach, which works exactly as expected there.

export function isNativeExportTarget(): boolean {
  return Capacitor.isNativePlatform();
}

async function shareWrittenFile(fileName: string, uri: string): Promise<void> {
  await Share.share({
    url: uri,
    dialogTitle: fileName,
  });
}

/** Save+share binary file content (image/PDF) given as a base64 string with no data-URI prefix. */
export async function saveBinaryFileNative(base64Data: string, fileName: string): Promise<boolean> {
  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });
    await shareWrittenFile(fileName, result.uri);
    return true;
  } catch (err) {
    console.error('Failed to save/share binary file natively:', err);
    return false;
  }
}

/** Save+share plain text file content (e.g. JSON export). */
export async function saveTextFileNative(content: string, fileName: string): Promise<boolean> {
  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await shareWrittenFile(fileName, result.uri);
    return true;
  } catch (err) {
    console.error('Failed to save/share text file natively:', err);
    return false;
  }
}
