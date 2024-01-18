import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { FileInfo } from "@/lib/types";

export default function FileLink({ fileInfo }: { fileInfo: FileInfo }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [downloadedLink, setDownloadedLink] = useState("");

  useEffect(() => {
    if (linkRef.current && downloadedLink != fileInfo.fileURL) {
      linkRef.current?.click();
      setDownloadedLink(fileInfo.fileURL);
    }
  }, [downloadedLink, fileInfo.fileURL]);

  if (fileInfo.fileURL) {
    return (
      <Link
        ref={linkRef}
        className="text-primary underline decoration-solid line-clamp-1"
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
