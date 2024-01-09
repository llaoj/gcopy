export interface UserInfo {
  email: string;
  isLoggedIn: boolean;
}

export const defaultUserInfo: UserInfo = {
  email: "",
  isLoggedIn: false,
};

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
