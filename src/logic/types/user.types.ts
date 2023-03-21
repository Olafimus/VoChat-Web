import { VocObj } from "./vocab.types";

export type AppUser = {
  name: string;
  email: string;
  id?: string;
  lastActive: number;
  createdAt: number;
  conversations: string[];
  teachLanguages: string[];
  learnLanguages: string[];
  friends?: Friend[];
  allVocabs: VocObj[];
};

export type OnlineUser = {
  id: string;
  name: string;
  email: string;
};

export type Friend = {
  id: string;
  lastInteraction: number;
  conversation: string;
};

export type Contact = Friend & {
  name: string;
  lastMessage: string;
};
