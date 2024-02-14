export interface UserInfo {
  email: string;
  isLoggedIn: boolean;
}

export const defaultUserInfo: UserInfo = {
  email: "",
  isLoggedIn: false,
};
