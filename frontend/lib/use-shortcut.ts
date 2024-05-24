import { useEffect } from "react";
import { isDesktop, isMacOs } from "react-device-detect";

export function useShortcut({ eventHandler }: { eventHandler: () => void }) {
  useEffect(() => {
    function keyDownHandler(e: globalThis.KeyboardEvent) {
      if (!isDesktop) {
        return;
      }
      // refer: https://support.google.com/chrome/answer/157179
      if (
        e.key === "Enter" ||
        (isMacOs && e.metaKey && e.key == "1") ||
        (!isMacOs && e.ctrlKey && e.key == "1")
      ) {
        e.preventDefault();
        eventHandler();
      }
    }
    document.addEventListener("keydown", keyDownHandler);
    return () => document.removeEventListener("keydown", keyDownHandler);
  });
}
