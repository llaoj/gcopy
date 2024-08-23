"use client";

import LogBox from "@/components/log-box";
import FileLink from "@/components/file-link";
import useAuth from "@/lib/auth";
import { LogLevel, useLog } from "@/lib/log";
import { DragEvent, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  initTmpClipboard,
  clipboardWriteBlob,
  clipboardWriteBlobPromise,
  hashBlob,
  toTextBlob,
  Clipboard,
  FileInfo,
  initFileInfo,
  clipboardRead,
} from "@/lib/clipboard";
// Chrome | Safari | Mobile Safari
import { browserName, isAndroid } from "react-device-detect";
import SyncButton from "@/components/sync-button";
import SyncShortcut from "@/components/sync-shortcut";
import QuickInput from "@/components/quick-input";
import History from "@/components/history";
import { db } from "@/models/db";
import { HistoryItemEntity } from "@/models/history";
import moment from "moment";

// route: /locale?ci=123&cbi=abc
// - ci: clipboard index
// - cbi: clipboard blob id
export default function SyncClipboard() {
  const t = useTranslations("SyncClipboard");
  const [fileInfo, setFileInfo] = useState<FileInfo>(initFileInfo);
  const [tmpClipboard, setTmpClipboard] = useState<Clipboard>(initTmpClipboard);
  // "" | interrupted-[r|w] | finished
  const [status, setStatus] = useState<string>("");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locale = useLocale();
  const { isLoading, loggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { logs, addLog, resetLog } = useLog();

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <span className="loading loading-ring loading-lg"></span>
      </div>
    );
  }

  const updateFileLink = (fileInfo: FileInfo) => {
    setFileInfo(fileInfo);
  };

  const addHistoryItem = async (history: HistoryItemEntity) => {
    if (history.pin != "true") history.pin = "false";
    history.createdAt = moment().format();
    history.dataArrayBuffer = await history.data.arrayBuffer();
    history.dataType = history.data.type;
    await db.history.put(history);
    const items = await db.history
      .where("pin")
      .equals("false")
      .reverse()
      .primaryKeys();
    items.map((item, idx) => {
      if (idx > 19) db.history.where("createdAt").equals(item).delete();
    });
  };

  const ensureLoggedIn = () => {
    if (!loggedIn) {
      router.push(`/${locale}/user/email-code`);
      return false;
    }
    return true;
  };

  const sleep = function (ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const pullClipboard = async () => {
    resetLog();
    addLog({ message: t("logs.fetching") });
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
      addLog({ message: body.message, level: LogLevel.Error });
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
      addLog({ message: t("logs.upToDate") });

      if (browserName.includes("Safari")) {
        setStatus("interrupted-r");
        addLog({ message: t("logs.pressAgain"), level: LogLevel.Warn });
        addLog({ message: t("logs.pressPaste"), level: LogLevel.Warn });
        return;
      }

      await pushClipboard();
      return;
    }
    const xclientname = response.headers.get("x-clientname");
    addLog({
      message: t("logs.received", {
        type: t(xtype),
        index: xindex,
        clientname: xclientname ?? "UNKNOWN",
      }),
    });

    let blob = await response.blob();

    if (xtype == "text" || xtype == "screenshot") {
      // Format or rebuild blob
      if (xtype == "text") {
        blob = await toTextBlob(blob);
      }

      const nextBlobId: string = await hashBlob(blob);
      if (nextBlobId == searchParams.get("cbi")) {
        return;
      }

      if (browserName.includes("Safari")) {
        setTmpClipboard({
          blobId: nextBlobId,
          index: xindex,
          data: blob,
          type: xtype,
        });
        setStatus("interrupted-w");
        addLog({ message: t("logs.pressAgain"), level: LogLevel.Warn });
        return;
      }

      await clipboardWriteBlob(blob);
      searchParams.set("ci", xindex);
      addLog({ message: t("logs.writeSuccess"), level: LogLevel.Success });

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

      await addHistoryItem({
        index: xindex,
        blobId: searchParams.get("cbi") ?? "",
        data: blob,
        type: xtype,
      });

      return;
    }

    if (xtype == "file") {
      let xfilename = response.headers.get("x-filename");
      if (xfilename == null || xfilename == "") {
        return;
      }
      xfilename = decodeURI(xfilename);
      let downloadedFile = new File([blob], xfilename, { type: blob.type });
      updateFileLink({
        fileName: xfilename,
        fileURL: URL.createObjectURL(downloadedFile),
      });
      addLog({ message: t("logs.autoDownload"), level: LogLevel.Success });
      // The file did not enter the clipboard,
      // so only update the index.
      searchParams.set("ci", xindex);
      window.history.replaceState(
        null,
        document.title,
        "?" + searchParams.toString(),
      );

      await addHistoryItem({
        index: xindex,
        data: downloadedFile,
        type: xtype,
        fileName: xfilename,
      });

      return;
    }
  };

  const pushClipboard = async () => {
    let blob = null;
    if (textareaRef.current && textareaRef.current.value != "") {
      blob = new Blob([textareaRef.current.value], { type: "text/plain" });
      addLog({ message: t("logs.readQuickInputSuccess") });
    }

    if (textareaRef.current?.value == "") {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        return;
      }
      blob = await clipboardRead();
      addLog({ message: t("logs.readClipboardSuccess") });
    }

    if (!blob) {
      addLog({ message: t("logs.emptyClipboard") });
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
        addLog({
          message: t("logs.unsupportedFormat", { format: blob.type }),
          level: LogLevel.Error,
        });
        xtype = "";
    }
    if (xtype == "") {
      return;
    }

    const nextBlobId = await hashBlob(blob);
    const searchParams = new URLSearchParams(window.location.search);
    if (nextBlobId == searchParams.get("cbi")) {
      addLog({ message: t("logs.unchanged") });
      return;
    }
    addLog({ message: t("logs.uploading") });

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
      addLog({ message: body.message, level: LogLevel.Error });
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

    await addHistoryItem({
      index: xindex,
      blobId: nextBlobId,
      data: blob,
      type: xtype,
    });

    addLog({
      message: t("logs.uploaded", { type: t(xtype), index: xindex }),
      level: LogLevel.Success,
    });
  };

  const uploadFileHandler = async (file: File) => {
    resetLog();
    addLog({ message: t("logs.uploading") });
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
      addLog({ message: body.message, level: LogLevel.Error });
      return;
    }
    const xindex = response.headers.get("x-index");
    if (xindex == null || xindex == "0") {
      return;
    }

    updateFileLink({
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

    await addHistoryItem({
      index: xindex,
      data: file,
      type: "file",
      fileName: file.name,
    });

    addLog({
      message: t("logs.uploaded", { type: t("file"), index: xindex }),
      level: LogLevel.Success,
    });

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
          addLog({ message: t("logs.denyRead"), level: LogLevel.Error });
          return;
        }
      }

      // Safari requires that every call to the clipboard API must be triggered by the user.
      // So we have to interrupt before the next call to the clipboard API.
      if (status == "interrupted-w") {
        await clipboardWriteBlobPromise(tmpClipboard.data);
        // Known bug:
        //   This blobId is hashed by the fetched blob
        //   which is different from the blob read from clipboard.
        //   So this will upload the blob back to the server once.
        window.history.replaceState(
          null,
          document.title,
          `${pathname}?ci=${tmpClipboard.index}&cbi=${tmpClipboard.blobId}`,
        );

        await addHistoryItem({
          index: tmpClipboard.index,
          blobId: tmpClipboard.blobId,
          data: tmpClipboard.data,
          type: tmpClipboard.type,
        });

        addLog({ message: t("logs.writeSuccess"), level: LogLevel.Success });

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
      addLog({ message: String(err), level: LogLevel.Error });
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
          <span className="font-bold">{t("syncFile.title")}</span>
          <span>{" " + t("syncFile.subTitle")}</span>
        </div>
        <div
          className={clsx(
            "preview min-h-24 md:min-h-52 border rounded-box flex flex-col items-center justify-center gap-y-1 px-4",
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
              <div className="text-lg opacity-40 hidden md:block">
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
      <History addLog={addLog} updateFileLink={updateFileLink} />
    </>
  );
}
