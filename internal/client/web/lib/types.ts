export interface User {
  isLoggedIn: boolean;
  email: string;
}

export interface Log {
  level: string;
  message: string;
}

export interface Clipboard {
  blobId: string;
  index: string;
}

export interface FileInfo {
  fileName: string;
  fileURL: string;
}
