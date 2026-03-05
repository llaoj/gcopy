export interface Clipboard {
  index: string;
  data: Blob;
  blobId?: string;
  type?: string;
  fileName?: string;
  clientName?: string;
}

export interface FileInfo {
  fileName: string;
  fileURL: string;
}

export const initFileInfo: FileInfo = {
  fileName: "",
  fileURL: "",
};

export const initTmpClipboard: Clipboard = {
  blobId: "",
  index: "",
  data: new Blob([]),
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
  try {
    let items = await navigator.clipboard.read();

    if (!items || items.length === 0) {
      return null;
    }

    // 如果 types 数组为空，无法读取
    // 这种情况需要使用 paste 事件（见 sync-clipboard.tsx）
    if (items[0].types.length === 0) {
      return null;
    }

    // 支持的图片类型（按优先级）
    const imageTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/bmp",
      "image/gif",
    ];

    // 支持的文本类型（按优先级）
    const textTypes = ["text/plain", "text/html", "text/uri-list"];

    // 优先读取图片
    for (const imageType of imageTypes) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].types.includes(imageType)) {
          try {
            return await items[i].getType(imageType);
          } catch (err) {
            console.warn(`Failed to read ${imageType}:`, err);
            continue;
          }
        }
      }
    }

    // 然后读取文本
    for (const textType of textTypes) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].types.includes(textType)) {
          try {
            return await items[i].getType(textType);
          } catch (err) {
            console.warn(`Failed to read ${textType}:`, err);
            continue;
          }
        }
      }
    }

    // Fallback: 尝试读取第一个可用的类型
    for (let i = 0; i < items.length; i++) {
      for (const type of items[i].types) {
        try {
          return await items[i].getType(type);
        } catch (err) {
          console.warn(`Failed to read type ${type}:`, err);
          continue;
        }
      }
    }

    console.error("All clipboard types failed to read");
    return null;
  } catch (err) {
    console.error("Failed to read clipboard:", err);
    return null;
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

// Convert image to PNG format for clipboard compatibility
export async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") {
    return blob;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error("Failed to convert image to PNG"));
        }
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

export function isValidURL(str: string): boolean {
  try {
    const url = new URL(str);
    return ["http:", "https:", "ftp:"].includes(url.protocol);
  } catch (_) {
    return false;
  }
}
