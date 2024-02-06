"use client";

import LogBox from "@/components/log-box";
import FileLink from "@/components/file-link";
import useSession from "@/lib/use-session";
import { Log, Level } from "@/lib/log";
import { DragEvent, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import Title from "@/components/title";
import { useLocale, useTranslations } from "next-intl";
import {
  TemporaryClipboard,
  initTemporaryClipboard,
  clipboardWriteBlob,
  clipboardWriteBlobPromise,
  hashBlob,
  initClipboard,
  Clipboard,
  toTextBlob,
  FileInfo,
  initFileInfo,
  clipboardRead,
} from "@/lib/clipboard";
import { browserName } from "react-device-detect";
import SyncButton from "@/components/sync-button";

export default function SyncClipboard() {
  const t = useTranslations("SyncClipboard");
  const [clipboard, setClipboard] = useState<Clipboard>(initClipboard);
  const [fileInfo, setFileInfo] = useState<FileInfo>(initFileInfo);
  const [temporaryClipboard, setTemporaryClipboard] =
    useState<TemporaryClipboard>(initTemporaryClipboard);
  const [logs, setLogs] = useState<Log[]>([
    {
      level: Level.Warn,
      message: t("logs.clickToSync"),
    },
  ]);
  // "" | interrupted-[r|w] | finished
  const [status, setStatus] = useState<string>("");
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const locale = useLocale();
  const { session, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <span className="loading loading-ring loading-lg"></span>
      </div>
    );
  }

  const ensureLoggedIn = () => {
    if (!session.isLoggedIn) {
      router.push(`/${locale}/user/email-code`);
      return false;
    }
    return true;
  };

  const resetLog = () => {
    setLogs([]);
  };

  const addLog = (message: string, level?: Level) => {
    setLogs((current) => [
      ...current,
      { level: level ?? Level.Info, message: message },
    ]);
  };

  const pullClipboard = async () => {
    if (status == "interrupted-w") {
      await clipboardWriteBlobPromise(temporaryClipboard.blob);
      // This blobId is hashed by the fetched blob
      // which is different from the blob read from clipboard.
      // So this will upload the blob back to the server once.
      setClipboard({
        blobId: temporaryClipboard.blobId,
        index: temporaryClipboard.index,
      });
      addLog(t("logs.writeSuccess"), Level.Success);

      setTemporaryClipboard(initTemporaryClipboard);
      setStatus("finished");
      return;
    }

    if (status == "interrupted-r") {
      await pushClipboard();
      setStatus("finished");
      return;
    }

    resetLog();
    addLog(t("logs.fetching"));
    const response = await fetch("/api/v1/clipboard", {
      headers: {
        "X-Index": clipboard.index,
      },
    });

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
      xindex == clipboard.index ||
      xtype == "" ||
      xtype == null
    ) {
      addLog(t("logs.upToDate"));

      if (browserName == "Safari") {
        setStatus("interrupted-r");
        addLog(t("logs.clickAgain"), Level.Warn);
        addLog(t("logs.clickPaste"), Level.Warn);
        return;
      }

      await pushClipboard();
      return;
    }
    addLog(t("logs.received", { type: t(xtype), index: xindex }));

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
      if (nextBlobId == clipboard.blobId) {
        return;
      }

      if (browserName == "Safari") {
        setTemporaryClipboard({
          blobId: nextBlobId,
          index: xindex,
          blob: blob,
        });
        setStatus("interrupted-w");
        addLog(t("logs.clickAgain"), Level.Warn);
        return;
      }

      await clipboardWriteBlob(blob);
      // Although they are the same,
      // the blob read from the clipboard is different from
      // the blob just fetched from the server.
      setClipboard({
        blobId: await hashBlob(await clipboardRead()),
        index: xindex,
      });
      addLog(t("logs.writeSuccess"), Level.Success);

      return;
    }

    if (xtype == "file") {
      const xfilename = response.headers.get("x-filename");
      if (xfilename == null || xfilename == "") {
        return;
      }
      // The file did not enter the clipboard,
      // so only update the index.
      setClipboard((current) => {
        return {
          ...current,
          index: xindex,
        };
      });
      setFileInfo({
        fileName: decodeURI(xfilename),
        fileURL: URL.createObjectURL(blob),
        autoDownloaded: false,
      });
    }
  };

  const pushClipboard = async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      return;
    }
    let blob = await clipboardRead();
    let xtype;
    switch (blob.type) {
      case "text/plain":
      case "text/html":
        xtype = "text";
        blob = await toTextBlob(blob);
        break;
      case "image/png":
        xtype = "screenshot";
        break;
      default:
        xtype = "";
    }
    if (xtype == "") {
      return;
    }

    const nextBlobId = await hashBlob(blob);
    if (nextBlobId == clipboard.blobId) {
      addLog(t("logs.unchanged"));
      return;
    }
    addLog(t("logs.readSuccess"));
    addLog(t("logs.uploading", { object: t(xtype) }));

    const response = await fetch("/api/v1/clipboard", {
      method: "POST",
      headers: {
        "Content-Type": blob.type,
        "X-Type": xtype,
        "X-FileName": "",
      },
      body: blob,
    });

    if (response.status != 200) {
      const body = await response.json();
      addLog(body.message, Level.Error);
      return;
    }
    const xindex = response.headers.get("x-index");
    if (xindex == null || xindex == "0") {
      return;
    }

    setClipboard({
      blobId: nextBlobId,
      index: xindex,
    });
    addLog(
      t("logs.uploaded", { type: t(xtype), index: xindex }),
      Level.Success,
    );
  };

  const uploadFileHandler = async (file: File) => {
    resetLog();
    if (file.size > 10 * 1024 * 1024) {
      addLog(t("logs.fileTooLarge"), Level.Error);
      return;
    }

    addLog(t("logs.uploading", { object: file.name }));
    const response = await fetch("/api/v1/clipboard", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-Type": "file",
        "X-FileName": encodeURI(file.name),
      },
      body: file,
    });
    if (response.status != 200) {
      const body = await response.json();
      addLog(body.message, Level.Error);
      return;
    }
    const xindex = response.headers.get("x-index");
    if (xindex == null || xindex == "0") {
      return;
    }

    // The file did not enter the clipboard,
    // so only update the index.
    setClipboard((current) => {
      return {
        ...current,
        index: xindex,
      };
    });
    setFileInfo({
      fileName: file.name,
      fileURL: "",
      autoDownloaded: false,
    });
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
      if (browserName != "Safari") {
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

      await pullClipboard();
      setStatus((current) =>
        current.startsWith("interrupted") ? current : "finished",
      );
    } catch (e) {
      addLog(String(e), Level.Error);
    }
  };

  const autoDownloaded = () => {
    setFileInfo((current) => {
      return {
        ...current,
        autoDownloaded: true,
      };
    });
  };

  return (
    <>
      <div className="pb-4">
        <Title title={t("title")} subTitle={t("subTitle")}></Title>
        <div className="grid grid-cols-9 gap-3 w-full">
          <LogBox logs={logs} />
          <SyncButton syncFunc={syncFunc} />
        </div>
      </div>

      <div className="pb-4">
        <Title
          title={t("syncFile.title")}
          subTitle={t("syncFile.subTitle")}
        ></Title>

        <div
          className={clsx(
            "preview h-40 border rounded-box flex flex-col items-center justify-center gap-y-1 px-4",
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
              <FileLink
                fileInfo={fileInfo}
                autoDownloadedFunc={autoDownloaded}
              />
              <div className="text-lg opacity-40">
                {t("syncFile.dragDropTip")}
              </div>
              <button
                className="btn btn-sm"
                onClick={() => {
                  if (!ensureLoggedIn()) {
                    return;
                  }
                  inputRef.current?.click();
                }}
              >
                {t("syncFile.fileInputText")}
              </button>
            </>
          )}
          <input
            type="file"
            hidden
            ref={inputRef}
            onChange={async () => {
              if (inputRef.current?.files) {
                const selectedFile = inputRef.current.files[0];
                await uploadFileHandler(selectedFile);
              }
            }}
          />
        </div>
      </div>
    </>
  );
}
