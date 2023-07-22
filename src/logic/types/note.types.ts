export type Note = {
  owner: string;
  id: string;
  type: "message" | "note";
  language: string;
  message: string[];
  sender: string;
  sendTime: number;
  savedTime: number;
  checked: boolean;
  note?: string[];
  date?: string;
  delete?: boolean;
  ref?: { conversation: string; msgId: string };
};
