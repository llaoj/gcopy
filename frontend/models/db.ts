import Dexie, { Table } from "dexie";
import { HistoryItemEntity } from "./history";

export class DB extends Dexie {
  history!: Table<HistoryItemEntity, string>;
  constructor() {
    super("HistoryDB");
    this.version(1).stores({
      history: "createdAt, blobId, pin",
    });
  }
}
export const db = new DB();
