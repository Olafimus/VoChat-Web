export type VocObj = {
  owner: string;
  id: string;
  dataId?: string;
  createdAt: number;
  vocLanguage: string;
  transLanguage: string;
  vocab: string[];
  translation: string[];
  pronunciation: string[];
  hints: string[];
  categories: string[];
  workbooks: WorkbookType[];
  setImportance: number;
  calcImportance: number;
  learnHistory: { timeStamp: number; result: boolean }[];
  score: number;
  favored: boolean;
  favoredAt: number;
  lastUpdated: number;
  checkStatus: {
    checked: boolean;
    corrected: boolean;
    lastCorBy: string | null;
    lastCheckBy: string | null;
    lastChecked: number;
  };
  receivedFrom?: string;
  added?: boolean;
};

export type WorkbookType = {
  owner: string;
  name: string;
  id: string;
  vocCount?: number;
  vocLanguage: string;
  transLanguage: string;
  score: number;
  createdAt: number;
  createdBy: string;
  lastUpdated: number;
  lastLearned: number;
};

// export const dummyVocObj = {
//   id: nanoid(),
//   language: "farsi",
//   createdAt: new Date(),
//   vocab: ["برنج", "rice"],
//   translation: ["reis", "lecker"],
//   hints: ["This is a basic food, which is famous in asia"],
//   pronunciation: ["berenj"],
//   categories: ["food", "tasty"],
//   workbooks: [
//     { name: "food", id: "asdadstring" },
//     { name: "basic", id: "fjk24a" },
//   ],
//   setImportance: 8,
//   calcImportance: null,
//   learnHistory: [
//     { timeStamp: Date.now() - 456123, result: true },
//     { timeStamp: Date.now() - 12345, result: true },
//     { timeStamp: Date.now(), result: false },
//   ],
//   score: 88,
// };
