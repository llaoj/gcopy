"use client";

import LogBox from "@/components/log-box";
import useAuth from "@/lib/auth";
import useSystemInfo from "@/hooks/useSystemInfo";
import useRemoteClipboardStatus from "@/hooks/useRemoteClipboardStatus";
import { LogLevel, useLog, SyncDirection } from "@/lib/log";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  initTmpClipboard,
  clipboardWriteBlob,
  clipboardWriteBlobPromise,
  hashBlob,
  toTextBlob,
  toPngBlob,
  Clipboard,
  clipboardRead,
} from "@/lib/clipboard";
import { loadClipboardState, saveClipboardState } from "@/lib/clipboard-state";
import { redirectToLogin } from "@/lib/navigation";
// Chrome | Safari | Mobile Safari
import {
  browserName,
  isAndroid,
  isMobile,
  isMobileSafari,
} from "react-device-detect";
import SyncButton from "@/components/sync-button";
import SyncShortcut from "@/components/sync-shortcut";
import SyncFile from "@/components/sync-file";
import QuickInput from "@/components/quick-input";
import History from "@/components/history";
import { db } from "@/models/db";
import { HistoryItemEntity } from "@/models/history";
import moment from "moment";
import { validateFileSize, downloadBlob } from "@/lib/file-utils";

// route: /
// The clipboard sync cursor (server index + content hash) is kept in
// localStorage per user, not in the URL, so reloads keep it and sharing a link
// cannot leak a stale "already up to date" state.
export default function SyncClipboard() {
  const t = useTranslations("SyncClipboard");
  // 最近一次 push（上传）出去的文件名
  const [fileName, setFileName] = useState<string>("");
  const [tmpClipboard, setTmpClipboard] = useState<Clipboard>(initTmpClipboard);
  // "" | interrupted-[r|w] | finished
  const [status, setStatus] = useState<string>("");
  // 快捷输入框内容
  const [quickText, setQuickText] = useState<string>("");
  // 等待用户粘贴特殊剪贴板内容（如微信图片）
  const [waitingForPaste, setWaitingForPaste] = useState<boolean>(false);
  // 同步方向，用于日志框红绿灯动画：
  //   pending = 已触发但方向未定；in = 服务器→本机；out = 本机→服务器
  const [syncDirection, setSyncDirection] = useState<SyncDirection>(null);

  const { loggedIn, userId } = useAuth();
  const { systemInfo } = useSystemInfo();
  const router = useRouter();
  const { logs, addLog, resetLog, updateProgressLog } = useLog();

  // 后台检查远端是否有更新; 同步进行中或等待用户粘贴时暂停.
  const { hasNew } = useRemoteClipboardStatus({
    userId,
    enabled: loggedIn,
    paused:
      syncDirection !== null ||
      waitingForPaste ||
      status.startsWith("interrupted"),
  });

  // 清空"最近上传文件名"的显示
  const resetFile = () => {
    setFileName("");
  };

  const addHistoryItem = useCallback(async (history: HistoryItemEntity) => {
    if (history.pin != "true") history.pin = "false";
    history.createdAt = moment().format();
    const buffer = await history.data.arrayBuffer();
    history.dataArrayBuffer = buffer.slice(0);
    history.dataType = history.data.type;
    // Mobile Safari 不存储 data 相关字段，其他浏览器正常存储
    if (isMobileSafari) {
      // Mobile Safari 清空 data 字段，只存储元数据
      delete (history as any).data;
    }

    await db.history.put(history);
    const items = await db.history
      .where("pin")
      .equals("false")
      .reverse()
      .primaryKeys();
    await Promise.all(
      items.map((item, idx) => {
        if (idx > 19)
          return db.history.where("createdAt").equals(item).delete();
      }),
    );
  }, []);

  const ensureLoggedIn = useCallback(async () => {
    if (!loggedIn) {
      redirectToLogin(router);
      return false;
    }
    return true;
  }, [loggedIn, router]);

  const sleep = function (ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  // 带进度跟踪的XMLHttpRequest上传
  const uploadWithProgress = (
    url: string,
    method: string,
    headers: Record<string, string>,
    body: Blob,
    onProgress: (progress: number) => void,
  ): Promise<{ status: number; headers: Headers; body: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);

      // 设置headers
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        const headers = new Headers();
        xhr
          .getAllResponseHeaders()
          .split("\r\n")
          .forEach((line) => {
            const [key, value] = line.split(": ");
            if (key && value) {
              headers.set(key, value);
            }
          });
        resolve({
          status: xhr.status,
          headers,
          body: xhr.responseText,
        });
      };

      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(body);
    });
  };

  /**
   * 上传剪贴板内容到服务器
   * 统一处理文本和图片的上传逻辑
   */
  const uploadClipboardBlob = useCallback(
    async (blob: Blob): Promise<boolean> => {
      let xtype: string;
      let processedBlob = blob;

      // 确定类型并转换格式
      if (blob.type.startsWith("image/")) {
        xtype = "screenshot";
        // 如果不是 PNG，转换为 PNG（浏览器剪贴板标准格式）
        if (blob.type !== "image/png") {
          processedBlob = await toPngBlob(blob);
        }
      } else if (blob.type.startsWith("text/")) {
        xtype = "text";
        processedBlob = await toTextBlob(blob);
      } else {
        addLog({
          message: t("logs.unsupportedFormat", { format: blob.type }),
          level: LogLevel.Error,
        });
        return false;
      }

      const nextBlobId = await hashBlob(processedBlob);
      const { cbi } = loadClipboardState(userId);

      // 检查是否与当前剪贴板内容相同
      if (nextBlobId === cbi) {
        addLog({ message: t("logs.unchanged") });
        return false;
      }

      // Reset file states when uploading text or screenshot
      resetFile();

      addLog({ message: t("logs.uploading"), isProgress: true });

      setSyncDirection("out");
      try {
        const response = await uploadWithProgress(
          "/api/v1/clipboard",
          "POST",
          {
            "Content-Type": processedBlob.type,
            "X-Type": xtype,
            "X-FileName": "",
          },
          processedBlob,
          (progress) => {
            updateProgressLog(`${t("logs.uploading")} ${progress}%`);
          },
        );

        if (response.status == 401) {
          redirectToLogin(router);
          return false;
        }

        if (response.status != 200) {
          try {
            const body = JSON.parse(response.body);
            addLog({ message: body.message, level: LogLevel.Error });
          } catch {
            addLog({ message: response.body, level: LogLevel.Error });
          }
          return false;
        }

        const xindex = response.headers.get("x-index");
        if (xindex == null || xindex == "0") {
          return false;
        }

        saveClipboardState(userId, {
          ci: Number(xindex),
          cbi: nextBlobId,
        });

        await addHistoryItem({
          index: xindex,
          blobId: nextBlobId,
          data: processedBlob,
          type: xtype,
        });

        addLog({
          message: t("logs.uploaded", { type: t(xtype), index: xindex }),
          level: LogLevel.Success,
        });

        return true;
      } finally {
        setSyncDirection(null);
      }
    },
    [userId, addLog, t, addHistoryItem, updateProgressLog, router],
  );

  /**
   * 处理从 paste 事件获取的剪贴板内容（图片或文字）
   */
  const handlePastedContent = useCallback(
    async (file: File) => {
      if (!(await ensureLoggedIn())) {
        return;
      }

      // 方向（out）由 uploadClipboardBlob 内部设置并在结束后清理
      const success = await uploadClipboardBlob(file);
      if (success) {
        setStatus("finished");
      }
    },
    [ensureLoggedIn, uploadClipboardBlob],
  );

  /**
   * ============================================================================
   * paste 事件监听器 - 支持微信图片等特殊剪贴板内容
   * ============================================================================
   *
   * 为什么需要这个监听器？
   *
   * 某些应用程序（如微信）复制的图片无法通过 navigator.clipboard.read() API 读取，
   * 但可以通过 paste 事件的 clipboardData.items 读取。
   *
   * 技术原因：
   * 1. 异步 Clipboard API (navigator.clipboard.read())
   *    - 可以随时调用（需要权限）
   *    - 浏览器会"清理"不标准的数据格式
   *    - 对于微信图片，types 数组为空，无法读取
   *
   * 2. 同步 DataTransfer API (paste 事件)
   *    - 只能在用户触发的 paste 事件中访问
   *    - 提供原始剪贴板数据，浏览器不进行额外清理
   *    - 微信图片会以 `image/jpeg` 格式出现在 items 中
   *
   * 官方文档：
   * - W3C Clipboard API (异步): https://w3c.github.io/clipboard-apis/#async-clipboard-api
   *   "User agents may choose to sanitize clipboard data for privacy or
   *    security reasons when using the async clipboard API."
   *
   * - HTML DataTransfer (同步): https://html.spec.whatwg.org/multipage/dnd.html#the-datatransfer-interface
   *   DataTransfer 在 paste 事件中提供"原始剪贴板数据"
   *
   * - Clipboard Security: https://w3c.github.io/clipboard-apis/#security
   *   "Browsers may remove or modify clipboard items for security reasons"
   *
   * 解决方案：
   * 当 navigator.clipboard.read() 读不到内容时，提示用户按 Ctrl+V，
   * 通过 paste 事件读取原始数据。
   */
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // 只在等待粘贴状态时处理
      if (!waitingForPaste) {
        return;
      }

      if (!e.clipboardData?.items) {
        return;
      }

      // 检查剪贴板内容类型
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];

        // 如果是图片文件
        if (item.kind === "file" && item.type.startsWith("image/")) {
          e.preventDefault();

          const file = item.getAsFile();
          if (file) {
            // 重置等待状态
            setWaitingForPaste(false);
            addLog({ message: t("logs.readClipboardSuccess") });

            // 处理图片上传
            await handlePastedContent(file);
          }
          return;
        }

        // 如果是文字内容
        if (item.kind === "string") {
          e.preventDefault();

          const text = e.clipboardData.getData(item.type);
          if (text) {
            // 重置等待状态
            setWaitingForPaste(false);
            addLog({ message: t("logs.readClipboardSuccess") });

            // 创建 File 对象并处理
            const file = new File([text], "clipboard.txt", {
              type: "text/plain",
            });
            await handlePastedContent(file);
          }
          return;
        }
      }

      addLog({ message: t("logs.emptyClipboard") });
    };

    // 添加 paste 事件监听器
    document.addEventListener("paste", handlePaste);

    // 清理
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [waitingForPaste, loggedIn, router, addLog, handlePastedContent, t]);

  // 带进度跟踪的fetch下载
  const fetchWithProgress = async (
    url: string,
    options: RequestInit,
    onProgress: (progress: number) => void,
  ): Promise<{ response: Response; blob: () => Promise<Blob> }> => {
    const response = await fetch(url, options);

    if (!response.ok || !response.body) {
      return {
        response,
        blob: () => response.blob(),
      };
    }

    const contentLength = response.headers.get("content-length");
    if (!contentLength) {
      return {
        response,
        blob: () => response.blob(),
      };
    }

    const total = parseInt(contentLength, 10);

    const reader = response.body.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        let loaded = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          if (value) {
            loaded += value.length;
            onProgress(Math.round((loaded / total) * 100));
            controller.enqueue(value);
          }
        }

        controller.close();
      },
    });

    return {
      response,
      blob: async () => new Response(stream).blob(),
    };
  };

  const pullClipboard = async () => {
    resetLog();
    addLog({ message: t("logs.fetching"), isProgress: true });
    const { ci: localIndex, cbi: localCbi } = loadClipboardState(userId);

    // 使用带进度的fetch
    const { response, blob: getBlob } = await fetchWithProgress(
      "/api/v1/clipboard",
      {
        headers: {
          "X-Index": localIndex ? String(localIndex) : "",
        },
      },
      (progress) => {
        updateProgressLog(`${t("logs.fetching")} ${progress}%`);
      },
    );

    if (response.status == 401) {
      redirectToLogin(router);
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
      Number(xindex) === localIndex ||
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
    setSyncDirection("in");
    addLog({
      message: t("logs.received", {
        type: t(xtype),
        index: xindex,
        clientname: xclientname ?? "UNKNOWN",
      }),
    });

    let blob = await getBlob();

    if (xtype == "text" || xtype == "screenshot") {
      // Format or rebuild blob
      if (xtype == "text") {
        blob = await toTextBlob(blob);
      } else if (xtype == "screenshot") {
        // Convert image to PNG for clipboard compatibility
        blob = await toPngBlob(blob);
      }

      const nextBlobId: string = await hashBlob(blob);
      if (nextBlobId === localCbi) {
        // Same content under a new index: remember the index so we don't fetch
        // it again (and so the "new content" hint clears), but don't rewrite
        // the clipboard.
        saveClipboardState(userId, {
          ci: Number(xindex),
          cbi: nextBlobId,
        });
        return;
      }

      // Reset file states when receiving text or screenshot
      resetFile();

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
      let nextCbi = nextBlobId;
      const shadowBlob = await clipboardRead();
      if (shadowBlob) {
        nextCbi = await hashBlob(shadowBlob);
      } else {
        console.warn("Failed to read back clipboard after writing");
      }

      saveClipboardState(userId, { ci: Number(xindex), cbi: nextCbi });

      await addHistoryItem({
        index: xindex,
        blobId: nextCbi,
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

      // 先将 blob 转换为 ArrayBuffer，避免在异步操作中被垃圾回收
      const arrayBuffer = await blob.arrayBuffer();
      // iOS Safari: 强制使用 application/octet-stream 避免 Safari 渲染 PDF 等文件
      let downloadedFile = new File([arrayBuffer], xfilename, {
        type: "application/octet-stream",
      });

      // 先插入历史记录，确保数据安全保存
      const fileBlobId = await hashBlob(downloadedFile);
      saveClipboardState(userId, {
        ci: Number(xindex),
        cbi: fileBlobId,
      });
      await addHistoryItem({
        index: xindex,
        blobId: fileBlobId,
        data: downloadedFile,
        type: xtype,
        fileName: xfilename,
      });

      // 接收到的文件直接触发下载，不在"同步文件"框里显示，同时清空该框
      downloadBlob(downloadedFile, xfilename);
      resetFile();
      addLog({ message: t("logs.autoDownload"), level: LogLevel.Success });

      return;
    }
  };

  const pushClipboard = async () => {
    let blob = null;
    if (quickText != "") {
      blob = new Blob([quickText], { type: "text/plain" });
      addLog({ message: t("logs.readQuickInputSuccess") });
    } else {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        return;
      }
      blob = await clipboardRead();

      if (!blob && !isMobile) {
        /**
         * ============================================================
         * 特殊剪贴板内容处理（如微信图片）
         * ============================================================
         *
         * 当 navigator.clipboard.read() 返回 null 时，可能是：
         * 1. 剪贴板确实为空
         * 2. 剪贴板包含特殊格式（如微信图片），异步 API 无法读取
         *
         * 对于情况2，我们需要使用 paste 事件来读取。
         * 提示用户按 Ctrl+V (Mac: Cmd+V) 来粘贴内容。
         *
         * 技术细节：
         * - 微信图片在 navigator.clipboard.read() 中 types 数组为空
         * - 但在 paste 事件的 clipboardData.items 中可以读取
         * - 这是浏览器安全模型的差异导致的
         *
         * 参考文档：
         * - https://w3c.github.io/clipboard-apis/#security
         * - https://w3c.github.io/clipboard-apis/#async-clipboard-api
         */

        // 尝试提示用户粘贴特殊内容
        addLog({
          message: t("logs.specialClipboardPleasePaste"),
          level: LogLevel.Warn,
        });

        // 激活 paste 事件监听
        setWaitingForPaste(true);
        return;
      }

      if (blob) {
        addLog({ message: t("logs.readClipboardSuccess") });
      }
    }

    if (!blob) {
      addLog({ message: t("logs.emptyClipboard") });
      return;
    }

    const success = await uploadClipboardBlob(blob);

    // 清空快速输入框
    if (success && quickText != "") {
      setQuickText("");
    }
  };

  const uploadFileHandler = async (file: File) => {
    resetLog();
    try {
      // Validate file size
      if (systemInfo) {
        const validation = validateFileSize(file, systemInfo.maxContentLength);
        if (!validation.valid) {
          addLog({
            message: t("logs.fileTooLarge", {
              size: (file.size / (1024 * 1024)).toFixed(2),
              limit: systemInfo.maxContentLength,
            }),
            level: LogLevel.Error,
          });
          return;
        }
      }

      const fileHash = await hashBlob(file);
      const { cbi } = loadClipboardState(userId);
      if (fileHash === cbi) {
        addLog({ message: t("logs.fileUnchanged") });
        setStatus("finished");
        return;
      }

      setSyncDirection("out");
      addLog({ message: t("logs.uploading"), isProgress: true });

      const response = await uploadWithProgress(
        "/api/v1/clipboard",
        "POST",
        {
          "Content-Type": file.type,
          "X-Type": "file",
          "X-FileName": encodeURI(file.name),
        },
        file,
        (progress) => {
          updateProgressLog(`${t("logs.uploading")} ${progress}%`);
        },
      );

      if (response.status == 401) {
        redirectToLogin(router);
        return;
      }

      if (response.status != 200) {
        try {
          const body = JSON.parse(response.body);
          addLog({ message: body.message, level: LogLevel.Error });
        } catch {
          addLog({ message: response.body, level: LogLevel.Error });
        }
        return;
      }
      const xindex = response.headers.get("x-index");
      if (xindex == null || xindex == "0") {
        return;
      }

      // 只显示文件名 不自动下载文件
      setFileName(file.name);

      // The file did not enter the clipboard,
      // so we update the index and set cbi to the file's blob ID
      saveClipboardState(userId, {
        ci: Number(xindex),
        cbi: fileHash,
      });

      await addHistoryItem({
        index: xindex,
        blobId: fileHash,
        data: file,
        type: "file",
        fileName: file.name,
      });

      addLog({
        message: t("logs.uploaded", { type: t("file"), index: xindex }),
        level: LogLevel.Success,
      });

      setStatus("finished");
    } finally {
      setSyncDirection(null);
    }
  };

  const handleFileChange = async (file: File) => {
    if (!(await ensureLoggedIn())) {
      return;
    }
    await uploadFileHandler(file);
  };

  const syncFunc = async () => {
    setSyncDirection("pending");
    try {
      if (!(await ensureLoggedIn())) {
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
        saveClipboardState(userId, {
          ci: Number(tmpClipboard.index),
          cbi: tmpClipboard.blobId ?? "",
        });

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
    } finally {
      setSyncDirection(null);
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
          <SyncButton syncFunc={syncFunc} hasNew={hasNew} />
          <LogBox logs={logs} direction={syncDirection} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <SyncFile fileName={fileName} onFileChange={handleFileChange} />
        <QuickInput value={quickText} onChange={setQuickText} />
      </div>
      <History addLog={addLog} />
    </>
  );
}
