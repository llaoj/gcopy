import { Clipboard } from "@/lib/clipboard";

export interface HistoryItemEntity extends Clipboard {
  createdAt?: string;
  pin?: string;
  // Fix error on Safari: Failed to load resource: The operation couldn’t be completed. (WebKitBlobResource error 1.)
  // https://stackoverflow.com/questions/68386273/error-loading-blob-to-img-in-safari-webkitblobresource-error-1
  dataArrayBuffer?: ArrayBuffer;
  dataType?: string;
}
