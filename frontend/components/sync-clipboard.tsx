"use client";

import LogBox from "@/components/log-box";
import FileLink from "@/components/file-link";
import useAuth from "@/lib/auth";
import { Log, Level } from "@/lib/log";
import { DragEvent, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations, useFormatter } from "next-intl";
import {
  TmpClipboard,
  initTmpClipboard,
  clipboardWriteBlob,
  clipboardWriteBlobPromise,
  hashBlob,
  toTextBlob,
  FileInfo,
  initFileInfo,
  clipboardRead,
} from "@/lib/clipboard";
// Chrome | Safari | Mobile Safari
import { osName, browserName, isAndroid } from "react-device-detect";
import SyncButton from "@/components/sync-button";
import SyncShortcut from "@/components/sync-shortcut";
import QuickInput from "@/components/quick-input";

// route: /locale?ci=123&cbi=abc
// - ci: clipboard index
// - cbi: clipboard blob id
export default function SyncClipboard() {
  const t = useTranslations("SyncClipboard");
  const format = useFormatter();
  const [fileInfo, setFileInfo] = useState<FileInfo>(initFileInfo);
  const [tmpClipboard, setTmpClipboard] =
    useState<TmpClipboard>(initTmpClipboard);
  // "" | interrupted-[r|w] | finished
  const [status, setStatus] = useState<string>("");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locale = useLocale();
  const { isLoading, loggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  let initLogs = [
    {
      level: Level.Warn,
      message: t("logs.pressToSync"),
    },
  ];
  const recommendedBrowsers = [
    { osName: "Windows", browsers: ["Chrome", "Edge", "Opera"] },
    { osName: "iOS", browsers: ["Mobile Safari"] },
    { osName: "Android", browsers: ["Chrome", "Edge"] },
    { osName: "Mac OS", browsers: ["Chrome", "Opera", "Safari"] },
  ];
  recommendedBrowsers.map((item) => {
    if (osName == item.osName && !item.browsers.includes(browserName)) {
      initLogs = [
        {
          level: Level.Info,
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <span className="loading loading-ring loading-lg"></span>
      </div>
    );
  }

  const ensureLoggedIn = () => {
    if (!loggedIn) {
      router.push(`/${locale}/user/email-code`);
      return false;
    }
    return true;
  };

  const resetLog = () => {
    setLogs([]);
  };

  const sleep = function (ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const addLog = (message: string, level?: Level) => {
    setLogs((current) => [
      ...current,
      { level: level ?? Level.Info, message: message },
    ]);
  };

  const pullClipboard = async () => {
    resetLog();
    addLog(t("logs.fetching"));
    const searchParams = new URLSearchParams(window.location.search);
    const response = await fetch("/api/v1/clipboard", {
      headers: {
        "X-Index": searchParams.get("ci") ?? "",
      },
    });

    if (response.status == 401) {
      router.push(`/${locale}/user/email-code`);
      return;
    }

    if (response.status != 200) {
      const body = await response.json();
      addLog(body.message, Level.Error);
      return;
    }
    const xindex = response.headers.get("x-index");
    const xtype = response.headers.get("x-type");
    if (
      xindex == null ||
      xindex == "0" ||
      xindex == searchParams.get("ci") ||
      xtype == "" ||
      xtype == null
    ) {
      addLog(t("logs.upToDate"));

      if (browserName.includes("Safari")) {
        setStatus("interrupted-r");
        addLog(t("logs.pressAgain"), Level.Warn);
        addLog(t("logs.pressPaste"), Level.Warn);
        return;
      }

      await pushClipboard();
      return;
    }
    const xclientname = response.headers.get("x-clientname");
    addLog(
      t("logs.received", {
        type: t(xtype),
        index: xindex,
        clientname: xclientname ?? "UNKNOWN",
      }),
    );

    if (xtype == "file") {
      addLog(t("logs.autoDownload"), Level.Success);
    }

    let blob = await response.blob();

    // Format or rebuild blob
    if (xtype == "text") {
      blob = await toTextBlob(blob);
    }

    if (xtype == "text" || xtype == "screenshot") {
      const nextBlobId: string = await hashBlob(blob);
      if (nextBlobId == searchParams.get("cbi")) {
        return;
      }

      if (browserName.includes("Safari")) {
        setTmpClipboard({
          blobId: nextBlobId,
          index: xindex,
          blob: blob,
        });
        setStatus("interrupted-w");
        addLog(t("logs.pressAgain"), Level.Warn);
        return;
      }

      await clipboardWriteBlob(blob);
      searchParams.set("ci", xindex);
      addLog(t("logs.writeSuccess"), Level.Success);

      // Cannot read the clipboard after writing immediately on Chrome for Android, Edge for Android, Edge for HarmonyOS.
      // So, after writing, you need to wait for a while before you can read it.
      // Fix: NotFoundError: Failed to execute 'getType' on 'ClipboardItem': The type was not found
      // isAndroid=true on HarmonyOS 3.0/4.0
      if (isAndroid && ["Chrome", "Edge"].includes(browserName)) {
        // Known bug:
        //  Even though we waited for a while, we still might not be able to get it.
        await sleep(1000);
      }
      // Although they are the same,
      // the blob read from the clipboard is different from
      // the blob just fetched from the server.
      const shadowBlob = await clipboardRead();
      if (shadowBlob) {
        const realBlobId = await hashBlob(shadowBlob);
        searchParams.set("cbi", realBlobId);
      }

      window.history.replaceState(
        null,
        document.title,
        "?" + searchParams.toString(),
      );
      return;
    }

    if (xtype == "file") {
      const xfilename = response.headers.get("x-filename");
      if (xfilename == null || xfilename == "") {
        return;
      }
      setFileInfo({
        fileName: decodeURI(xfilename),
        fileURL: URL.createObjectURL(blob),
      });
      // The file did not enter the clipboard,
      // so only update the index.
      searchParams.set("ci", xindex);
      window.history.replaceState(
        null,
        document.title,
        "?" + searchParams.toString(),
      );
      return;
    }
  };

  const pushClipboard = async () => {
    let blob = null;
    if (textareaRef.current && textareaRef.current.value != "") {
      blob = new Blob([textareaRef.current.value], { type: "text/plain" });
      addLog(t("logs.readQuickInputSuccess"));
    }

    if (textareaRef.current?.value == "") {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        return;
      }
      blob = await clipboardRead();
      addLog(t("logs.readClipboardSuccess"));
    }

    if (!blob) {
      addLog(t("logs.emptyClipboard"));
      return;
    }
    let xtype;
    switch (blob.type) {
      case "text/plain":
      case "text/html":
      case "text/uri-list":
        xtype = "text";
        blob = await toTextBlob(blob);
        break;
      case "image/png":
        xtype = "screenshot";
        break;
      default:
        addLog(t("logs.unsupportedFormat", { format: blob.type }), Level.Error);
        xtype = "";
    }
    if (xtype == "") {
      return;
    }

    const nextBlobId = await hashBlob(blob);
    const searchParams = new URLSearchParams(window.location.search);
    if (nextBlobId == searchParams.get("cbi")) {
      addLog(t("logs.unchanged"));
      return;
    }
    addLog(t("logs.uploading"));

    const response = await fetch("/api/v1/clipboard", {
      method: "POST",
      headers: {
        "Content-Type": blob.type,
        "X-Type": xtype,
        "X-FileName": "",
      },
      body: blob,
    });

    if (response.status == 401) {
      router.push(`/${locale}/user/email-code`);
      return;
    }

    if (response.status != 200) {
      const body = await response.json();
      addLog(body.message, Level.Error);
      return;
    }

    if (textareaRef.current && textareaRef.current.value != "") {
      textareaRef.current.value = "";
    }

    const xindex = response.headers.get("x-index");
    if (xindex == null || xindex == "0") {
      return;
    }

    window.history.replaceState(
      null,
      document.title,
      `${pathname}?ci=${xindex}&cbi=${nextBlobId}`,
    );
    addLog(
      t("logs.uploaded", { type: t(xtype), index: xindex }),
      Level.Success,
    );
  };

  const uploadFileHandler = async (file: File) => {
    resetLog();

    addLog(t("logs.uploading"));
    const response = await fetch("/api/v1/clipboard", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-Type": "file",
        "X-FileName": encodeURI(file.name),
      },
      body: file,
    });

    if (response.status == 401) {
      router.push(`/${locale}/user/email-code`);
      return;
    }

    if (response.status != 200) {
      const body = await response.json();
      addLog(body.message, Level.Error);
      return;
    }
    const xindex = response.headers.get("x-index");
    if (xindex == null || xindex == "0") {
      return;
    }

    setFileInfo({
      fileName: file.name,
      fileURL: "",
    });
    // The file did not enter the clipboard,
    // so only update the index.
    const searchParams = new URLSearchParams(window.location.search);
    window.history.replaceState(
      null,
      document.title,
      `${pathname}?ci=${xindex}&cbi=${searchParams.get("cbi") ?? ""}`,
    );
    addLog(
      t("logs.uploaded", { type: t("file"), index: xindex }),
      Level.Success,
    );

    setStatus("finished");
  };

  const syncFunc = async () => {
    try {
      if (!ensureLoggedIn()) {
        return;
      }

      // Ask for permission
      if (!browserName.includes("Safari")) {
        const permissionClipboardRead: PermissionName =
          "clipboard-read" as PermissionName;
        const permission = await navigator.permissions.query({
          name: permissionClipboardRead,
        });
        if (permission.state === "denied") {
          addLog(t("logs.denyRead"), Level.Error);
          return;
        }
      }

      // Safari requires that every call to the clipboard API must be triggered by the user.
      // So we have to interrupt before the next call to the clipboard API.
      if (status == "interrupted-w") {
        await clipboardWriteBlobPromise(tmpClipboard.blob);
        // Known bug:
        //   This blobId is hashed by the fetched blob
        //   which is different from the blob read from clipboard.
        //   So this will upload the blob back to the server once.
        window.history.replaceState(
          null,
          document.title,
          `${pathname}?ci=${tmpClipboard.index}&cbi=${tmpClipboard.blobId}`,
        );
        addLog(t("logs.writeSuccess"), Level.Success);

        setTmpClipboard(initTmpClipboard);
        setStatus("finished");
        return;
      }
      if (status == "interrupted-r") {
        await pushClipboard();
        setStatus("finished");
        return;
      }

      await pullClipboard();

      setStatus((current) =>
        current.startsWith("interrupted") ? current : "finished",
      );
    } catch (err) {
      addLog(String(err), Level.Error);
      setStatus("finished");
    }
  };

  return (
    <>
      <div className="pb-4">
        <div className="pb-2 text-base font-bold">{t("title")}</div>
        <div className="pb-2 text-sm opacity-70">
          {t("subTitle")}
          <SyncShortcut />
        </div>
        <div className="grid grid-cols-9 gap-3 w-full">
          <LogBox logs={logs} />
          <SyncButton syncFunc={syncFunc} />
        </div>
      </div>
      <QuickInput textareaRef={textareaRef} />
      <div className="pb-4">
        <div className="pb-2 text-sm opacity-70">
          <strong>{t("syncFile.title") + ": "}</strong>
          {t("syncFile.subTitle")}
        </div>
        <div
          className={clsx(
            "preview min-h-52 border rounded-box flex flex-col items-center justify-center gap-y-1 px-4",
            { "border-primary text-primary": dragging },
            { "border-base-300": !dragging },
          )}
          onDragOver={(ev: DragEvent<HTMLElement>) => {
            ev.preventDefault();
          }}
          onDragEnter={() => {
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={async (ev: DragEvent<HTMLElement>) => {
            ev.preventDefault();
            if (!ensureLoggedIn()) {
              return;
            }
            if (ev.dataTransfer && ev.dataTransfer.files) {
              const droppedFile = ev.dataTransfer.files[0];
              await uploadFileHandler(droppedFile);
            }
            setDragging(false);
          }}
        >
          {!dragging && (
            <>
              <FileLink fileInfo={fileInfo} />
              <div className="text-lg opacity-40">
                {t("syncFile.dragDropTip")}
              </div>
              <button
                className="btn btn-sm"
                onClick={() => {
                  if (!ensureLoggedIn()) {
                    return;
                  }
                  fileInputRef.current?.click();
                }}
              >
                {t("syncFile.fileInputText")}
              </button>
            </>
          )}
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={async () => {
              if (fileInputRef.current?.files) {
                const selectedFile = fileInputRef.current.files[0];
                await uploadFileHandler(selectedFile);
              }
            }}
          />
        </div>
      </div>
    </>
  );
}
