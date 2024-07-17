import { Clipboard } from "@/lib/clipboard";

export interface HistoryItemEntity extends Clipboard {
  createdAt?: string;
  pin?: string;
}
