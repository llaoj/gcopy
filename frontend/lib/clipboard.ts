export interface Clipboard {
  blobId: string;
  index: string;
}

export const initClipboard: Clipboard = {
  blobId: "",
  index: "",
};

export interface FileInfo {
  fileName: string;
  fileURL: string;
  autoDownloaded: boolean;
}

export const initFileInfo: FileInfo = {
  fileName: "",
  fileURL: "",
  autoDownloaded: false,
};

export interface TemporaryClipboard {
  blobId: string;
  index: string;
  blob: Blob;
}

export const initTemporaryClipboard: TemporaryClipboard = {
  blobId: "",
  index: "",
  blob: new Blob([]),
};

export function clipboardWriteBlob(blob: Blob) {
  return navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

// https://w3c.github.io/clipboard-apis/#async-clipboard-api
export function clipboardWriteBlobPromise(blob: Blob) {
  return navigator.clipboard.write([
    new ClipboardItem({ [blob.type]: Promise.resolve(blob) }),
  ]);
}

export async function clipboardRead() {
  const clipboardItems = await navigator.clipboard.read();
  const clipboardItem = clipboardItems[0];
  const itemType = clipboardItem.types[0];
  return clipboardItem.getType(itemType);
}

export async function hashBlob(blob: Blob): Promise<string> {
  const uint8Array = new Uint8Array(await blob.arrayBuffer());
  const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((h) => h.toString(16).padStart(2, "0")).join("");
}

export function toTextBlob(blob: Blob) {
  let type = blob.type;
  if (type == "text/html") {
    return blob.text().then((text) => {
      type = "text/plain";
      return new Blob([text], { type });
    });
  }
  if (type == "text/plain") {
    return blob;
  }
  return new Blob([""], { type: "text/plain" });
}
