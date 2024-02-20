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

export interface TmpClipboard {
  blobId: string;
  index: string;
  blob: Blob;
}

export const initTmpClipboard: TmpClipboard = {
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
  let items = await navigator.clipboard.read();
  if (items && items[0]) {
    return items[0].getType(items[0].types[0]);
  }
}

export async function hashBlob(blob: Blob): Promise<string> {
  const uint8Array = new Uint8Array(await blob.arrayBuffer());
  const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((h) => h.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

export function toTextBlob(blob: Blob) {
  let type = blob.type;
  if (type == "text/html" || type == "text/uri-list") {
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
