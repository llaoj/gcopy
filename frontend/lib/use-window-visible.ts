import { useState, useEffect } from "react";

const isVisible = () =>
  typeof document !== "undefined" && document.visibilityState == "visible";

const useWindowVisible = () => {
  const [visible, setVisible] = useState(isVisible);

  useEffect(() => {
    setVisible(isVisible());

    const onVisibilitychange = () => {
      if (document.visibilityState == "visible") {
        setVisible(true);
      } else if (document.visibilityState == "hidden") {
        setVisible(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilitychange);

    return () => {
      window.removeEventListener("visibilitychange", onVisibilitychange);
    };
  }, []);

  return visible;
};

export default useWindowVisible;
