import { useState } from "react";
import { osName, browserName } from "react-device-detect";
import { useTranslations, useFormatter } from "next-intl";

export enum LogLevel {
  Warn = "warn",
  Error = "error",
  Success = "success",
  Info = "info",
}

export interface Log {
  level?: LogLevel;
  message: string;
}

const recommendedBrowsers = [
  { osName: "Windows", browsers: ["Chrome", "Edge", "Opera"] },
  { osName: "iOS", browsers: ["Mobile Safari"] },
  { osName: "Android", browsers: ["Chrome", "Edge"] },
  { osName: "Mac OS", browsers: ["Chrome", "Opera", "Safari"] },
];

export function useLog() {
  const t = useTranslations("SyncClipboard");
  const format = useFormatter();

  let initLogs = [
    {
      level: LogLevel.Warn,
      message: t("logs.pressToSync"),
    },
  ];

  recommendedBrowsers.map((item) => {
    if (osName == item.osName && !item.browsers.includes(browserName)) {
      initLogs = [
        {
          level: LogLevel.Info,
          message: t("logs.recommendedBrowsers", {
            os: item.osName,
            browsers: format.list(item.browsers),
          }),
        },
        ...initLogs,
      ];
    }
  });

  const [logs, setLogs] = useState<Log[]>(initLogs);

  const addLog = (log: Log) => {
    setLogs((current) => [
      ...current,
      { level: log.level ?? LogLevel.Info, message: log.message },
    ]);
  };

  const resetLog = () => {
    setLogs([]);
  };

  return { logs, addLog, resetLog };
}
