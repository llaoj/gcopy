"use client";

import LogBox from "@/components/log-box";
import useAuth from "@/lib/auth";
import useSystemInfo from "@/hooks/useSystemInfo";
import useRemoteClipboardStatus from "@/hooks/useRemoteClipboardStatus";
import { LogLevel, useLog, SyncDirection } from "@/lib/log";
import { useState, useEffect, useCallback, useRef } from "react";
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
import { browserName, isAndroid, isMobile } from "react-device-detect";
import SyncButton from "@/components/sync-button";
import SyncShortcut from "@/components/sync-shortcut";
import SyncFile from "@/components/sync-file";
import { createZipFile } from "@/lib/zip-files";
import QuickInput from "@/components/quick-input";
import History from "@/components/history";
import { db } from "@/models/db";
import {
  HISTORY_RECENT_LIMIT,
  HistoryItemEntity,
  sortByCreatedAtDesc,
} from "@/models/history";
import moment from "moment";
import { validateFileSize, downloadBlob } from "@/lib/file-utils";
import { UploadError, uploadBlobWithRetry } from "@/lib/upload";
import { PROMPT_TIMEOUT_MS } from "@/lib/sync-prompt";
import type { PendingPrompt } from "@/lib/sync-prompt";

// route: /
// The clipboard sync cursor (server index + content hash) is kept in
// localStorage per user, not in the URL, so reloads keep it and sharing a link
// cannot leak a stale "already up to date" state.
export default function SyncClipboard() {
  const t = useTranslations("SyncClipboard");
  // 最近一次 push（上传）出去的文件名
  const [fileName, setFileName] = useState<string>("");
  const [fileUploading, setFileUploading] = useState<boolean>(false);
  const fileUploadingRef = useRef<boolean>(false);
  const [tmpClipboard, setTmpClipboard] = useState<Clipboard>(initTmpClipboard);
  // 快捷输入框内容
  const [quickText, setQuickText] = useState<string>("");
  // 需要用户下一步操作的挂起状态：
  //   paste        = 等待用户粘贴特殊剪贴板内容（如微信图片）
  //   safari-read  = Safari 需要用户再次点击以读取剪贴板
  //   safari-write = Safari 需要用户再次点击以写入剪贴板
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const promptRef = useRef<PendingPrompt | null>(null);
  // 同步流程当前方向，用于日志框红绿灯动画：
  //   pending = 已触发但方向未定；in = 服务器→本机；out = 本机→服务器
  // 等待用户操作期间方向保持不变，流程结束或取消后才清空。
  const [syncDirection, setSyncDirection] = useState<SyncDirection>(null);

  const { loggedIn, userId } = useAuth();
  const { systemInfo } = useSystemInfo();
  const router = useRouter();
  const { logs, addLog, resetLog, updateProgressLog } = useLog();

  // 后台检查远端是否有更新; 同步中或等待用户操作时暂停.
  const { hasNew } = useRemoteClipboardStatus({
    userId,
    enabled: loggedIn,
    paused: syncDirection !== null,
  });

  const setPendingPrompt = useCallback((kind: PendingPrompt | null) => {
    promptRef.current = kind;
    setPrompt(kind);
  }, []);

  const clearPrompt = useCallback(
    (reason: "canceled" | "timeout") => {
      setPendingPrompt(null);
      setSyncDirection(null);
      setTmpClipboard(initTmpClipboard);
      addLog({
        message: t(reason === "timeout" ? "prompt.timeout" : "prompt.canceled"),
        level: LogLevel.Warn,
      });
    },
    [addLog, t, setPendingPrompt],
  );

  const cancelPrompt = useCallback(
    () => clearPrompt("canceled"),
    [clearPrompt],
  );

  // 挂起状态不会一直等待：用户没注意时自动关闭，避免拦截后续粘贴。
  useEffect(() => {
    if (!prompt) {
      return;
    }

    const timer = setTimeout(() => clearPrompt("timeout"), PROMPT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [prompt, clearPrompt]);

  // 清空"最近上传文件名"的显示
  const resetFile = () => {
    setFileName("");
  };

  const addHistoryItem = useCallback(
    async (input: Clipboard & { pin?: string }) => {
      const { data, ...rest } = input;
      const buffer = await data.arrayBuffer();
      const item: HistoryItemEntity = {
        ...rest,
        dataArrayBuffer: buffer.slice(0),
        dataType: data.type,
        createdAt: moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        pin: input.pin === "true" ? "true" : "false",
      };

      await db.transaction("rw", db.history, async () => {
        await db.history.put(item);
        const items = await db.history.where("pin").equals("false").toArray();
        const stale = sortByCreatedAtDesc(items).slice(HISTORY_RECENT_LIMIT);
        if (stale.length > 0) {
          await db.history.bulkDelete(
            stale.map((staleItem) => staleItem.createdAt!),
          );
        }
      });
    },
    [],
  );

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

  /**
   * 上传任意内容到服务器。
   * 本地同步游标由调用方根据上传结果更新。
   */
  const pushBlobToServer = useCallback(
    async (
      blob: Blob,
      xtype: "text" | "screenshot" | "file",
      fileName: string,
      blobId: string,
    ): Promise<{ index: string; blobId: string } | null> => {
      addLog({ message: t("logs.uploading"), isProgress: true });

      setSyncDirection("out");
      try {
        const response = await uploadBlobWithRetry({
          url: "/api/v1/clipboard",
          blob,
          headers: {
            "Content-Type": blob.type,
            "X-Type": xtype,
            "X-FileName": xtype == "file" ? encodeURI(fileName) : "",
          },
          onProgress: (progress) => {
            updateProgressLog(`${t("logs.uploading")} ${progress}%`);
          },
          onRetry: () => {
            addLog({
              message: t("logs.uploadRetrying"),
              level: LogLevel.Warn,
            });
          },
        });

        if (response.status == 401) {
          redirectToLogin(router);
          return null;
        }

        if (response.status != 200) {
          try {
            const body = JSON.parse(response.body);
            addLog({ message: body.message, level: LogLevel.Error });
          } catch {
            addLog({ message: response.body, level: LogLevel.Error });
          }
          return null;
        }

        const xindex = response.headers.get("x-index");
        if (xindex == null || xindex == "0") {
          return null;
        }

        return { index: xindex, blobId };
      } catch (err) {
        if (err instanceof UploadError) {
          addLog({
            message:
              err.kind === "timeout"
                ? t("logs.uploadTimeout")
                : t("logs.uploadNetworkError"),
            level: LogLevel.Error,
          });
        } else {
          addLog({ message: String(err), level: LogLevel.Error });
        }
        return null;
      } finally {
        setSyncDirection(null);
      }
    },
    [addLog, t, updateProgressLog, router],
  );

  /**
   * 上传剪贴板内容到服务器
   * 统一处理文本和图片的上传逻辑
   */
  const uploadClipboardBlob = useCallback(
    async (blob: Blob): Promise<boolean> => {
      let xtype: "text" | "screenshot";
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

      const uploaded = await pushBlobToServer(
        processedBlob,
        xtype,
        "",
        nextBlobId,
      );
      if (!uploaded) {
        return false;
      }

      saveClipboardState(userId, {
        ci: Number(uploaded.index),
        cbi: uploaded.blobId,
      });

      await addHistoryItem({
        index: uploaded.index,
        blobId: uploaded.blobId,
        data: processedBlob,
        type: xtype,
      });

      addLog({
        message: t("logs.uploaded", {
          type: t(xtype),
          index: uploaded.index,
        }),
        level: LogLevel.Success,
      });

      return true;
    },
    [userId, addLog, t, addHistoryItem, pushBlobToServer],
  );

  /**
   * 将历史记录直接发送到服务器，不修改本机剪贴板，也不新增历史记录。
   * 该动作是用户显式触发的，因此不做 cbi 去重。
   */
  const shareHistoryItem = useCallback(
    async (item: HistoryItemEntity): Promise<boolean> => {
      if (!(await ensureLoggedIn())) {
        return false;
      }

      if (!item.dataArrayBuffer) {
        addLog({ message: t("logs.historyItemEmpty"), level: LogLevel.Error });
        return false;
      }

      const xtype = item.type;
      if (xtype !== "text" && xtype !== "screenshot" && xtype !== "file") {
        addLog({
          message: t("logs.unsupportedFormat", { format: xtype ?? "" }),
          level: LogLevel.Error,
        });
        return false;
      }

      try {
        let processedBlob = new Blob([item.dataArrayBuffer], {
          type: item.dataType,
        });

        if (xtype == "text") {
          processedBlob = await toTextBlob(processedBlob);
        } else if (xtype == "screenshot") {
          processedBlob = await toPngBlob(processedBlob);
        }

        if (systemInfo) {
          const validation = validateFileSize(
            processedBlob,
            systemInfo.maxContentLength,
          );
          if (!validation.valid) {
            addLog({
              message: t("logs.fileTooLarge", {
                size: (processedBlob.size / (1024 * 1024)).toFixed(2),
                limit: systemInfo.maxContentLength,
              }),
              level: LogLevel.Error,
            });
            return false;
          }
        }

        const blobId = await hashBlob(processedBlob);
        const uploaded = await pushBlobToServer(
          processedBlob,
          xtype,
          item.fileName ?? "",
          blobId,
        );
        if (!uploaded) {
          return false;
        }

        // 共享不会修改本机剪贴板，因此只推进服务端 index，保留 cbi。
        const { cbi } = loadClipboardState(userId);
        saveClipboardState(userId, {
          ci: Number(uploaded.index),
          cbi,
        });

        addLog({
          message: t("logs.uploaded", {
            type: t(xtype),
            index: uploaded.index,
          }),
          level: LogLevel.Success,
        });

        return true;
      } catch (err) {
        addLog({ message: String(err), level: LogLevel.Error });
        return false;
      }
    },
    [ensureLoggedIn, systemInfo, userId, addLog, t, pushBlobToServer],
  );

  /**
   * 处理从 paste 事件获取的剪贴板内容（图片或文字）
   */
  const handlePastedContent = useCallback(
    async (file: File) => {
      try {
        if (await ensureLoggedIn()) {
          await uploadClipboardBlob(file);
        }
      } finally {
        setSyncDirection(null);
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
    // 监听器只在等待粘贴时存在，避免常驻监听意外截获后续粘贴。
    if (prompt !== "paste") {
      return;
    }

    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        // 让输入框里的普通粘贴正常进行，不劫持用户输入。
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
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setPendingPrompt(null);
            addLog({ message: t("logs.readClipboardSuccess") });
            await handlePastedContent(file);
          }
          return;
        }

        // 如果是文字内容
        if (item.kind === "string") {
          const text = e.clipboardData.getData(item.type);
          if (text) {
            e.preventDefault();
            setPendingPrompt(null);
            addLog({ message: t("logs.readClipboardSuccess") });

            // 创建 File 对象并处理
            const file = new File([text], "clipboard.txt", {
              type: "text/plain",
            });
            await handlePastedContent(file);
            return;
          }
        }
      }

      addLog({ message: t("logs.emptyClipboard") });
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [prompt, addLog, handlePastedContent, setPendingPrompt, t]);

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
        setSyncDirection("pending");
        setPendingPrompt("safari-read");
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
        setSyncDirection("in");
        setPendingPrompt("safari-write");
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
        setSyncDirection("out");
        setPendingPrompt("paste");
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
      return;
    }

    const uploaded = await pushBlobToServer(file, "file", file.name, fileHash);
    if (!uploaded) {
      return;
    }

    saveClipboardState(userId, {
      ci: Number(uploaded.index),
      cbi: uploaded.blobId,
    });

    // 只显示文件名 不自动下载文件
    setFileName(file.name);

    await addHistoryItem({
      index: uploaded.index,
      blobId: uploaded.blobId,
      data: file,
      type: "file",
      fileName: file.name,
    });

    addLog({
      message: t("logs.uploaded", {
        type: t("file"),
        index: uploaded.index,
      }),
      level: LogLevel.Success,
    });
  };

  const handleFilesChange = async (files: File[]) => {
    if (files.length === 0 || fileUploadingRef.current) {
      return;
    }

    fileUploadingRef.current = true;
    setFileUploading(true);
    const multiple = files.length > 1;
    resetLog();

    try {
      if (!(await ensureLoggedIn())) {
        return;
      }

      if (!multiple) {
        await uploadFileHandler(files[0]);
        return;
      }

      const zipFile = await createZipFile(files);
      await uploadFileHandler(zipFile);
    } catch (err) {
      addLog({ message: String(err), level: LogLevel.Error });
    } finally {
      fileUploadingRef.current = false;
      setFileUploading(false);
    }
  };

  const syncFunc = async () => {
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
      if (prompt === "safari-write") {
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
        setPendingPrompt(null);
        setSyncDirection(null);
        return;
      }
      if (prompt === "safari-read") {
        setPendingPrompt(null);
        await pushClipboard();
        if (!promptRef.current) {
          setSyncDirection(null);
        }
        return;
      }

      setSyncDirection("pending");
      await pullClipboard();
      if (!promptRef.current) {
        setSyncDirection(null);
      }
    } catch (err) {
      addLog({ message: String(err), level: LogLevel.Error });
      setPendingPrompt(null);
      setTmpClipboard(initTmpClipboard);
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
          <SyncButton
            syncFunc={syncFunc}
            hasNew={hasNew}
            prompt={prompt}
            onCancelPrompt={cancelPrompt}
          />
          <LogBox logs={logs} direction={syncDirection} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <SyncFile
          fileName={fileName}
          uploading={fileUploading}
          onFilesChange={handleFilesChange}
        />
        <QuickInput value={quickText} onChange={setQuickText} />
      </div>
      <History addLog={addLog} onShare={shareHistoryItem} />
    </>
  );
}
