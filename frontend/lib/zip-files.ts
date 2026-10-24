import { zip } from "fflate";
import type { AsyncZippable } from "fflate";
import moment from "moment";

function uniqueName(name: string, used: Set<string>) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  let index = 1;
  let candidate = `${base}_${index}${extension}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}${extension}`;
  }

  used.add(candidate);
  return candidate;
}

export async function createZipFile(files: File[]): Promise<File> {
  const used = new Set<string>();
  const entries: AsyncZippable = {};

  for (const file of files) {
    const name = uniqueName(file.name || "file", used);
    entries[name] = [
      new Uint8Array(await file.arrayBuffer()),
      {
        mtime: new Date(
          Math.max(file.lastModified, new Date(1980, 0, 1).getTime()),
        ),
      },
    ];
  }

  const data = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });

  return new File(
    [data],
    `gcopy-files-${moment().format("YYYYMMDD-HHmmss")}.zip`,
    { type: "application/zip" },
  );
}
