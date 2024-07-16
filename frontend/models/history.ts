import { Clipboard } from "@/lib/clipboard";

export interface HistoryItem extends Clipboard {
  createdAt?: string;
  pin?: string;
}
