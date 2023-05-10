import { nanoid } from "@reduxjs/toolkit";

export type VocObj = {
  id: string;
  language: string;
  vocab: string[];
  translation: string[];
  pronounciation: string[];
  categorys: string[];
  workbooks: { name: string; id: string }[];
  setImportance: number;
  calcImp: number | null;
  learnHistory: { timeStamp: number; result: boolean }[];
  score: number;
};
