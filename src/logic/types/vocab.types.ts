export type VocObj = {
  id: string;
  language: string;
  vocab: string[];
  translation: string[];
  categorys: string[];
  workbooks: string[];
  setImportance: number;
  calcImp: number | null;
  learnHistory: { timeStamp: number; result: boolean }[];
  score: number;
};
