import { useTranslations } from "next-intl";
import HistoryItem from "./history-item";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/models/db";
import { Log } from "@/lib/log";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export default function History({ addLog }: { addLog: (log: Log) => void }) {
  const t = useTranslations("SyncClipboard.history");
  // 新加入列表的历史记录，用于播放"新数据进入"动画
  const [newId, setNewId] = useState<string | null>(null);
  // 见过的最大 createdAt，用于判断是否真有“新数据”进入（pin/unpin 不会使其变大）
  const maxSeenRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 每行上一次的布局位置，用于 FLIP：新数据进入时让其余行平滑下滑
  const rectsRef = useRef<Map<string, number>>(new Map());

  // 分离查询：pinned 和 unpinned items，减少不必要的重新渲染
  const pinnedItems = useLiveQuery(
    () => db.history.where("pin").equals("true").reverse().toArray(),
    [],
  );

  const recentItems = useLiveQuery(
    () => db.history.where("pin").equals("false").reverse().limit(20).toArray(),
    [],
  );

  // 新数据进入检测 + FLIP：新行播放 F 动画（由 isNew 驱动），
  // 其余行用 FLIP 平滑下滑到新位置。用 useLayoutEffect 在绘制前处理，避免闪烁。
  useLayoutEffect(() => {
    if (!pinnedItems || !recentItems) return;

    // 新数据必然是 createdAt 最大的一条。用“见过的最大 createdAt”判断：
    // pin/unpin 等重排不会产生更大的 createdAt，因此不会误触发动画。
    let currentMax: string | null = null;
    for (const item of [...pinnedItems, ...recentItems]) {
      const t = item.createdAt;
      if (t && (currentMax === null || t > currentMax)) {
        currentMax = t;
      }
    }
    const prevMax = maxSeenRef.current;
    let newTop: string | null = null;
    if (prevMax !== null && currentMax !== null && currentMax > prevMax) {
      newTop = currentMax;
    }
    if (currentMax !== null && (prevMax === null || currentMax > prevMax)) {
      maxSeenRef.current = currentMax;
    }
    if (newTop) {
      setNewId(newTop);
    }

    const container = listRef.current;
    if (!container) return;
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>("[data-key]"),
    );
    // 用 offsetTop 读取布局位置（容器是 offsetParent）：不受页面滚动影响，
    // 也不受已施加的 transform 影响（用 getBoundingClientRect 会因滚动产生错误位移）。
    const lasts = rows.map((el) => ({
      el,
      key: el.dataset.key as string,
      top: el.offsetTop,
    }));

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (newTop && !reduceMotion) {
      lasts.forEach(({ el, key, top: lastTop }) => {
        const stored = rectsRef.current.get(key);
        if (stored == null) return;
        const delta = stored - lastTop;
        if (Math.abs(delta) < 0.5) return;
        // Invert：先把行移回旧位置；Play：下一帧过渡到新位置
        el.style.transition = "none";
        el.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 350ms ease-out";
          el.style.transform = "";
        });
      });
    }

    rectsRef.current = new Map(lasts.map((l) => [l.key, l.top]));
  }, [recentItems, pinnedItems]);

  // 动画结束后清除标记
  useEffect(() => {
    if (!newId) return;
    const timer = setTimeout(() => setNewId(null), 600);
    return () => clearTimeout(timer);
  }, [newId]);

  // 使用 useCallback 稳定回调函数引用，避免每次渲染创建新函数
  const stableAddLog = useCallback((log: Log) => addLog(log), [addLog]);

  if (!pinnedItems || !recentItems) return null;

  return (
    <div className="pb-4">
      <div className="pb-2 text-base font-bold">{t("title")}</div>
      <div className="pb-2 text-sm opacity-70">{t("subTitle")}</div>
      <div
        ref={listRef}
        className="history-list relative bg-base-100 rounded-box mb-2 border border-base-300 divide-y divide-base-300"
      >
        {pinnedItems.length === 0 && recentItems.length === 0 && (
          <div className="px-2 py-2 text-sm opacity-50 text-center">
            {t("empty")}
          </div>
        )}
        {pinnedItems.map((item) => (
          <HistoryItem key={item.createdAt} item={item} addLog={stableAddLog} />
        ))}
        {recentItems.map((item) => (
          <HistoryItem
            key={item.createdAt}
            item={item}
            addLog={stableAddLog}
            isNew={item.createdAt === newId}
          />
        ))}
      </div>
    </div>
  );
}
