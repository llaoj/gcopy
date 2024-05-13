export interface FileInfo {
  fileName: string;
  fileURL: string;
}

export const initFileInfo: FileInfo = {
  fileName: "",
  fileURL: "",
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
  let imagePngIndex = null;
  let textPlainIndex = null;
  let textHtmlIndex = null;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].types.includes("image/png")) {
        imagePngIndex = i;
      }
      if (items[i].types.includes("text/plain")) {
        textPlainIndex = i;
      }
      if (items[i].types.includes("text/html")) {
        textHtmlIndex = i;
      }
    }
    if (imagePngIndex != null) {
      return items[imagePngIndex].getType("image/png");
    }
    if (textPlainIndex != null) {
      return items[textPlainIndex].getType("text/plain");
    }
    if (textHtmlIndex != null) {
      return items[textHtmlIndex].getType("text/html");
    }
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
  if (blob.type == "text/plain") {
    return blob;
  }
  return blob.text().then((text) => {
    return new Blob([text], { type: "text/plain" });
  });
}
