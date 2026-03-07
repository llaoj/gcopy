import { useEffect, useState } from "react";

export function useDevice() {
  const [device, setDevice] = useState({
    isDesktop: false,
    isMacOs: false,
    isSafari: false,
  });

  useEffect(() => {
    import("react-device-detect").then((m) => {
      setDevice({
        isDesktop: m.isDesktop,
        isMacOs: m.isMacOs,
        isSafari: m.isSafari,
      });
    });
  }, []);

  return device;
}
