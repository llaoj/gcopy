import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { FileInfo } from "@/lib/clipboard";

export default function FileLink({ fileInfo }: { fileInfo: FileInfo }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [autoClick, setAutoClick] = useState<string>("");

  useEffect(() => {
    if (fileInfo.fileURL != "" && fileInfo.fileURL != autoClick) {
      linkRef.current?.click();
      setAutoClick(fileInfo.fileURL);
    }
  }, [fileInfo.fileURL, autoClick]);

  if (fileInfo.fileURL) {
    return (
      <Link
        ref={linkRef}
        className="text-primary underline decoration-solid text-center w-full truncate"
        href={fileInfo.fileURL}
        target="_blank"
        download={fileInfo.fileName}
      >
        {fileInfo.fileName}
      </Link>
    );
  } else {
    return <p className="w-full text-center truncate">{fileInfo.fileName}</p>;
  }
}
