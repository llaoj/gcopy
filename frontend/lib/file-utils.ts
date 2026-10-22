/**
 * Validate if file size is within the allowed limit
 * @param blob The blob to validate
 * @param maxContentLengthMB Maximum content length in MiB
 * @returns { valid: boolean, message?: string }
 */
export function validateFileSize(
  blob: Blob,
  maxContentLengthMB: number,
): { valid: boolean; message?: string } {
  const fileSizeMB = blob.size / (1024 * 1024);

  if (fileSizeMB > maxContentLengthMB) {
    return {
      valid: false,
      message: `File size (${fileSizeMB.toFixed(
        2,
      )} MiB) exceeds the maximum limit (${maxContentLengthMB} MiB)`,
    };
  }

  return { valid: true };
}

/**
 * Trigger a browser download for a Blob using a temporary anchor element.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
