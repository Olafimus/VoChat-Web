import { Id } from "@reduxjs/toolkit/dist/tsHelpers";
import { Response } from "../../components/chat/message-box";
import { VocObj } from "./vocab.types";

export type Message = {
  id: string;
  time: number;
  language: string;
  sender: string;
  read: boolean;
  response?: Response;
  messageHis: MessageHisItem[];
};

export class MessageClass {
  constructor(
    readonly id: string,
    readonly time = Date.now(),
    public language = "farsi",
    readonly sender: string,
    public read = false
  ) {}
}

export type MessageHisItem = {
  time: number;
  editor: string;
  read: boolean;
  message: string;
  type: MsgHisTypes;
  response?: Response;
  vocab?: VocObj;
};

export type MsgHisTypes = "answer" | "standard" | "edit" | "vocab" | null;

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
