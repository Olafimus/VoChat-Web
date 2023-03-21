import { VocObj } from "./vocab.types";

export type Message = {
  id: string;
  time: number;
  language: string;
  sender: string;
  messageHis: MessageHisItem[];
};

export type MessageHisItem = {
  time: number;
  editor: string;
  message: string;
};

export type ConVoc = {
  time: number;
  id: string;
  sender: string;
  language: string;
  vocab: VocObj;
};

export type Correction = {
  originTxt: string;
  newTxt: string;
};
