import { AllVocabs, Vocab } from "./classes/vocab.class";

// const user = new User("Horst", "AfjeiA2", 2321, ["german"], ["english"]);
const voc = {
  id: "4213123",
  vocab: ["blue"],
  language: "english",
  translation: ["blau"],
  categorys: ["colors"],
  workbooks: [],
  setImportance: 3,
  calcImp: null,
  learnHistory: [],
  score: 0,
};
const voc2 = {
  id: "4213123",
  vocab: ["blue"],
  language: "english",
  translation: ["blau"],
  categorys: ["colors"],
  workbooks: [],
  setImportance: 3,
  calcImp: null,
  learnHistory: [],
  score: 0,
};

const voccArr = [voc, voc2];

const oliver = {
  name: "oliver",
  id: "fDA35Lj",
  lastActive: 823742,
  conversations: ["adahs"],
  teachLanguages: ["german"],
  learnLanguages: ["farsi"],
  friends: [],
  allVocabs: voccArr,
};

const convVoc = [
  {
    time: 23524234,
    id: "newID",
    sender: "userID",
    language: "farsi",
    vocab: "vocObj",
  },
];

class Test {
  constructor(public obj: { name: string; id: string }) {}
}
const horst = {
  name: "Horst",
  id: "Da2D",
};

const test = new Test(horst);