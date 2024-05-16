import { useEffect } from "react";

export function useShortcut({
  key,
  onKeyPressed,
}: {
  key: string;
  onKeyPressed: () => void;
}) {
  useEffect(() => {
    function keyDownHandler(e: globalThis.KeyboardEvent) {
      if (e.key === key) {
        e.preventDefault();
        onKeyPressed();
      }
    }
    document.addEventListener("keydown", keyDownHandler);
    return () => document.removeEventListener("keydown", keyDownHandler);
  });
}
