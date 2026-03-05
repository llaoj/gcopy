/**
 * Validate if file size is within the allowed limit
 * @param file The file to validate
 * @param maxContentLengthMB Maximum content length in MiB
 * @returns { valid: boolean, message?: string }
 */
export function validateFileSize(
  file: File,
  maxContentLengthMB: number,
): { valid: boolean; message?: string } {
  const fileSizeMB = file.size / (1024 * 1024);

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
