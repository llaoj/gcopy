import Dexie, { Table } from "dexie";
import { Clipboard } from "./clipboard";

export class DB extends Dexie {
  clipboards!: Table<Clipboard, string>;
  constructor() {
    super("ClipboardDB");
    this.version(1).stores({
      clipboards: "index",
    });
  }
}
export const db = new DB();
