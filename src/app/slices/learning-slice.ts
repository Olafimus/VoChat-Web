import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Vocab } from "../../logic/classes/vocab.class";
import { LearnRoutes } from "../../screens/vocba-screens/learning-route";

type learnState = {
  vocabs: Vocab[];
  currentVocabs: Vocab[];
  round: number;
  started: boolean;
  route: LearnRoutes;
  roundFinished: boolean;
  completed: boolean;
  checkedCount: number;
  currentResults: boolean[];
  currentIndex: number;
};

const initialState: learnState = {
  vocabs: [],
  currentVocabs: [],
  round: 1,
  started: false,
  route: null,
  roundFinished: false,
  completed: false,
  checkedCount: 0,
  currentResults: [],
  currentIndex: 0,
};

export const LearningSlice = createSlice({
  name: "learning",
  initialState,
  reducers: {
    setLearnVocabs: (s, a: PayloadAction<Vocab[]>) => {
      if (s.started) return;
      s.vocabs = a.payload;
    },
    setCurLearnVocabs: (
      s,
      a: PayloadAction<{ vocs: Vocab[]; withStarted: boolean }>
    ) => {
      if (s.started && !a.payload.withStarted) return;
      s.currentVocabs = a.payload.vocs;
    },

    setRoute: (s, a: PayloadAction<LearnRoutes>) => {
      s.route = a.payload;
    },
    setLearnStart: (s, a: PayloadAction<boolean>) => {
      s.started = a.payload;
    },
    setCompleted: (s, a: PayloadAction<boolean>) => {
      s.completed = a.payload;
    },
    setRoundFinished: (s, a: PayloadAction<boolean>) => {
      s.roundFinished = a.payload;
    },
    startNextLearnRound: (s) => {
      s.roundFinished = false;
      s.checkedCount = 0;
      s.currentResults = [];
      s.currentIndex = 0;
    },
    resetLearnSlice: (s) => {
      s.currentVocabs.forEach((voc) => voc.resetStatus());
      s.vocabs = [];
      s.currentVocabs = [];
      s.round = 1;
      s.started = false;
      s.route = null;
      s.roundFinished = false;
      s.completed = false;
      s.checkedCount = 0;
      s.currentResults = [];
    },
    checkVoc: (
      s,
      a: PayloadAction<{
        id: string;
        result: boolean;
        answer: string;
        index: number;
      }>
    ) => {
      const voc = s.currentVocabs.find((voc) => voc.getId() === a.payload.id);
      if (!voc) return;
      voc.setChecked(true);
      voc.setlastAnswer(a.payload.answer);
      const newCount = s.checkedCount + 1;
      s.checkedCount = newCount;
      voc.setResult(a.payload.result);
      s.currentResults.push(a.payload.result);
      if (newCount === s.currentVocabs.length) {
        s.roundFinished = true;
        if (s.currentResults.every((el) => el === true)) s.completed = true;
      }
      s.currentIndex = a.payload.index;
    },
  },
});

export const {
  setCurLearnVocabs,
  setLearnVocabs,
  startNextLearnRound,
  checkVoc,
  setRoute,
  setLearnStart,
  setRoundFinished,
  setCompleted,
  resetLearnSlice,
} = LearningSlice.actions;

export default LearningSlice.reducer;
