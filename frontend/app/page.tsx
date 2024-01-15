"use client";

import Navbar from "@/components/navbar";
import Notice from "@/components/notice";
import Title from "@/components/title";
import Footer from "@/components/footer";
import LogBox from "@/components/log-box";
import FileLink from "@/components/file-link";
import useSession from "@/lib/use-session";
import { Log, Clipboard, FileInfo } from "@/lib/types";
import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { DragEvent, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

export default function Home() {
  let syncLogs: Log[] = [
    {
      level: "text-warning",
      message: "click the right button to sync clipboard 👉",
    },
  ];
  const [logs, setLogs] = useState(syncLogs);
  const [clipboard, setClipboard] = useState<Clipboard>({
    blobId: "",
    index: "",
  });
  const [dragging, setDragging] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo>({
    fileName: "",
    fileURL: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { session, isLoading } = useSession();
  if (isLoading) {
    return (
      <span className="min-h-screen flex mx-auto loading loading-spinner loading-lg"></span>
    );
  }
  const ensureLoggedIn = () => {
    if (!session.isLoggedIn) {
      router.push("/user/email-code");
      return false;
    }
    return true;
  };

  const resetLog = () => {
    syncLogs = [];
    setLogs(syncLogs);
  };

  const addLog = (level: string, message: string) => {
    syncLogs = [...syncLogs, { level: level, message: message }];
    setLogs(syncLogs);
  };

  const addInfoLog = (message: string) => {
    addLog("", message);
  };

  const addSuccessLog = (message: string) => {
    addLog("text-green-600", message);
  };

  const addErrorLog = (message: string) => {
    addLog("text-rose-600", message);
  };

  const fetchClipboard = async () => {
    addInfoLog("fetching...");
    fetch("/api/v1/clipboard", {
      headers: {
        "X-Index": clipboard.index,
      },
    }).then(async (response) => {
      if (response.status != 200) {
        await response.json().then((body) => {
          addErrorLog(body.message);
        });
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
        addInfoLog("already up to date.");
        readClipboard();
        return;
      }
      addInfoLog("received " + xtype + "(" + xindex + ")");

      let blob = await response.blob();
      if (xtype == "text" || xtype == "screenshot") {
        let type = blob.type;
        if (type == "text/html") {
          await blob.text().then((text) => {
            type = "text/plain";
            blob = new Blob([text], { type });
          });
        }
        const nextBlobId: string = blob.type + blob.size;
        if (nextBlobId == clipboard.blobId) {
          return;
        }

        let data = [new ClipboardItem({ [type]: blob })];
        await navigator.clipboard.write(data).then(
          () => {
            setClipboard({
              blobId: nextBlobId,
              index: xindex,
            });
            addSuccessLog("wrote data to the clipboard successfully");
          },
          (err) => {
            addErrorLog(err);
          },
        );
      }

      if (xtype == "file") {
        const xfilename = response.headers.get("x-filename");
        if (xfilename == null || xfilename == "") {
          return;
        }
        setClipboard({
          blobId: clipboard.blobId,
          index: xindex,
        });
        setFileInfo({
          fileName: decodeURI(xfilename),
          fileURL: URL.createObjectURL(blob),
        });
        addInfoLog(
          "file download should start shortly. if not, please click the file link below.",
        );
      }
    });
  };

  const readClipboard = async () => {
    const permissionClipboardRead: PermissionName =
      "clipboard-read" as PermissionName;
    const permission = await navigator.permissions.query({
      name: permissionClipboardRead,
    });
    if (permission.state === "denied") {
      addErrorLog("not allowed to read clipboard!");
      return;
    }
    const clipboardItems = await navigator.clipboard.read();
    for (const clipboardItem of clipboardItems) {
      for (const type of clipboardItem.types) {
        let xtype = "";
        if (type == "text/plain") {
          xtype = "text";
        }
        if (type == "image/png") {
          xtype = "screenshot";
        }
        if (xtype == "") {
          return;
        }
        const blob = await clipboardItem.getType(type);

        const nextBlobId: string = blob.type + blob.size;
        if (nextBlobId == clipboard.blobId) {
          return;
        }
        addInfoLog("read data from the clipboard successfully.");

        fetch("/api/v1/clipboard", {
          method: "POST",
          headers: {
            "Content-Type": blob.type,
            "X-Type": xtype,
            "X-FileName": "",
          },
          body: blob,
        }).then(async (response) => {
          if (response.status != 200) {
            await response.json().then((body) => {
              addErrorLog(body.message);
            });
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
          addSuccessLog(xtype + "(" + xindex + ") uploaded.");
        });
      }
    }
  };

  const uploadFileHandler = async (file: File) => {
    resetLog();
    if (file.size > 10 * 1024 * 1024) {
      addErrorLog("sorry, the file cannot exceed 10mb!");
      return;
    }
    const nextBlobId: string = file.type + file.size + encodeURI(file.name);
    if (nextBlobId == clipboard.blobId) {
      return;
    }
    addInfoLog("uploading file " + file.name);

    await fetch("/api/v1/clipboard", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-Type": "file",
        "X-FileName": encodeURI(file.name),
      },
      body: file,
    }).then(async (response) => {
      if (response.status != 200) {
        await response.json().then((body) => {
          addErrorLog(body.message);
        });
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
      setFileInfo({
        fileName: file.name,
        fileURL: "",
      });
      addSuccessLog("file(" + xindex + ") uploaded.");
    });
  };

  const onClick = async () => {
    if (!ensureLoggedIn()) {
      return;
    }
    resetLog();
    fetchClipboard();
  };

  const onDrop = async (ev: DragEvent<HTMLElement>) => {
    ev.preventDefault();
    if (!ensureLoggedIn()) {
      return;
    }

    if (!ev.dataTransfer) {
      return;
    }
    if (ev.dataTransfer.files) {
      const droppedFile = ev.dataTransfer.files[0];
      if (droppedFile) {
        uploadFileHandler(droppedFile);
      }
    }
    setDragging(false);
  };
  const onDragEnter = () => {
    setDragging(true);
  };
  const onDragLeave = () => {
    setDragging(false);
  };
  const onDragOver = (ev: DragEvent<HTMLElement>) => {
    ev.preventDefault();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between mx-auto  max-w-5xl">
      <header className="p-6 w-full">
        <Navbar />
      </header>
      <main className="flex-1 p-6  w-full">
        <div className="pb-4">
          <Title
            title="Sync the clipboard"
            subTitle="Click the button on the right to synchronize the clipboard."
          ></Title>
          <div className="grid grid-cols-9 gap-3 w-full">
            <LogBox logs={logs} />
            <button
              className="btn btn-outline btn-primary col-span-2 h-full rounded-box bg-base-100 content-center"
              onClick={onClick}
            >
              <CursorArrowRippleIcon className="h-6 w-6" />
              <span>Click me</span>
              <span>to sync the clipboard</span>
            </button>
          </div>
        </div>

        <div className="pb-4">
          <Title
            title="Sync the files"
            subTitle="Drag and drop a file here to sync it to different devices."
          ></Title>

          <div
            className={clsx(
              "preview h-40 border rounded-box flex flex-col items-center justify-center gap-y-1 px-4",
              { "border-primary text-primary": dragging },
              { "border-base-300": !dragging },
            )}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {!dragging && (
              <>
                <FileLink fileInfo={fileInfo} />
                <div className="text-lg opacity-40">
                  drag and drop a file here
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    if (!ensureLoggedIn()) {
                      return;
                    }
                    inputRef.current && inputRef.current.click();
                  }}
                >
                  Choose a file
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
                  setDragging(false);
                }
              }}
            />
          </div>
        </div>

        <Notice />
      </main>
      <Footer />
    </div>
  );
}
