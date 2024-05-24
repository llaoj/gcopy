import { isDesktop, isMacOs, isSafari } from "react-device-detect";
export default function SyncShortcut() {
  if (!isDesktop) {
    return null;
  }

  return (
    <span className="float-end flex items-center">
      {isMacOs && !isSafari && (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="inline h-3 w-3 me-1"
            viewBox="0 0 16 16"
          >
            <path d="M3.5 2A1.5 1.5 0 0 1 5 3.5V5H3.5a1.5 1.5 0 1 1 0-3M6 5V3.5A2.5 2.5 0 1 0 3.5 6H5v4H3.5A2.5 2.5 0 1 0 6 12.5V11h4v1.5a2.5 2.5 0 1 0 2.5-2.5H11V6h1.5A2.5 2.5 0 1 0 10 3.5V5zm4 1v4H6V6zm1-1V3.5A1.5 1.5 0 1 1 12.5 5zm0 6h1.5a1.5 1.5 0 1 1-1.5 1.5zm-6 0v1.5A1.5 1.5 0 1 1 3.5 11z" />
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="inline h-3 w-3"
            viewBox="0 0 16 16"
          >
            <path d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0M9.283 4.002V12H7.971V5.338h-.065L6.072 6.656V5.385l1.899-1.383z" />
          </svg>
          <span className="mx-2 opacity-50">/</span>
        </>
      )}
      {!isMacOs && (
        <>
          Ctrl+
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="inline h-3 w-3"
            viewBox="0 0 16 16"
          >
            <path d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0M9.283 4.002V12H7.971V5.338h-.065L6.072 6.656V5.385l1.899-1.383z" />
          </svg>
          <span className="mx-2 opacity-50">/</span>
        </>
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        stroke="currentColor"
        fill="currentColor"
        className="inline h-3 w-3"
      >
        <path d="M360-240 120-480l240-240 56 56-144 144h488v-160h80v240H272l144 144-56 56Z" />
      </svg>
    </span>
  );
}
