export interface Clipboard {
  index: string;
  data: Blob;
  blobId?: string;
  type?: string;
  filename?: string;
  createdAt?: string;
  clientName?: string;
  pin?: boolean;
}
