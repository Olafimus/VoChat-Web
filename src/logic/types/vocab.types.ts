import { nanoid } from "@reduxjs/toolkit";

export type VocObj = {
  id: string;
  createdAt: Date;
  language: string;
  vocab: string[];
  translation: string[];
  pronounciation: string[];
  hints: string[];
  categories: string[];
  workbooks: workbookType[];
  setImportance: number;
  calcImportance: number | null;
  learnHistory: { timeStamp: number; result: boolean }[];
  score: number;
};

export type workbookType = {
  name: string;
  id: string;
  language: string;
  score: number;
  createdAt: number;
  createdBy: string;
  lastUpdated: number;
  lastLearned: number;
};

export const dummyVocObj = {
  id: nanoid(),
  language: "farsi",
  createdAt: new Date(),
  vocab: ["برنج", "rice"],
  translation: ["reis", "lecker"],
  hints: ["This is a basic food, which is famous in asia"],
  pronounciation: ["berenj"],
  categories: ["food", "tasty"],
  workbooks: [
    { name: "food", id: "asdadstring" },
    { name: "basic", id: "fjk24a" },
  ],
  setImportance: 8,
  calcImportance: null,
  learnHistory: [
    { timeStamp: Date.now() - 456123, result: true },
    { timeStamp: Date.now() - 12345, result: true },
    { timeStamp: Date.now(), result: false },
  ],
  score: 88,
};
