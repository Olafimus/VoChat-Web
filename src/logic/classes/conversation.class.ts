import { nanoid } from "@reduxjs/toolkit";
import {
  ConVoc,
  Correction,
  Message,
  MessageHisItem,
} from "../types/message.types";

export class ConversationCl {
  constructor(
    protected users: string[] = [],
    languages: string[],
    public messages: Message[] = [],
    protected corrections: Correction[] = [],
    protected vocabs: ConVoc[] = []
  ) {}

  getMessages() {
    return this.messages;
  }

  addMessageHis(iD: string, mes: MessageHisItem) {
    const message = this.messages.find((m) => m.id === iD);
    if (!message) return;
    message.messageHis.push(mes);
    // update Funktion für DatrenBank
  }
}

export type Conversation = {
  id: string;
  users: string[];
  languages: string[];
  messages: Message[];
  corrections: Correction[];
  vocabs: ConVoc[];
  unreadMsgs: number;
};

export const newConversation: Conversation = {
  id: "",
  users: [],
  languages: [],
  messages: [],
  corrections: [],
  vocabs: [],
  unreadMsgs: 0,
};

//  export class Contact {
//   constructor(
//     public name: string,
//     readonly id: string,
//     public lastInteraction: number = 0
//   ) {}
// }
