export enum Level {
  Warn = "warn",
  Error = "error",
  Success = "success",
  Info = "info",
}

export interface Log {
  level: Level;
  message: string;
}
