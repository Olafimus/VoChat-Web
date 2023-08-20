import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { VocObj, WorkbookType } from "../../logic/types/vocab.types";
import { addVocToDb, updateVocDb } from "../../utils/firebase/firebase-vocab";

interface VocabState {
  allUserVocabs: VocObj[];
  workbooks: WorkbookType[];
  loadedData: VocObj[];
  loadedLangs: string[];
  categories: string[];
  lastUpdate: number;
  currentLang: string;
  nativeLang: string;
  savedDbLangs: string[];
  dataVocStore: Record<string, VocObj[]>; // später createEntityAdapter
}

const initialState: VocabState = {
  allUserVocabs: [],
  workbooks: [],
  loadedData: [],
  loadedLangs: [],
  categories: [],
  lastUpdate: 0,
  currentLang: "Farsi",
  nativeLang: "German",
  savedDbLangs: [],
  dataVocStore: {},
};

export const VocabSlice = createSlice({
  name: "vocabs",
  initialState,
  reducers: {
    setVocabs: (state, actions: PayloadAction<VocObj[]>) => {
      state.allUserVocabs = actions.payload;
    },
    addVocab: (state, actions: PayloadAction<VocObj>) => {
      state.allUserVocabs.push(actions.payload);
      state.lastUpdate = Date.now();
    },
    updateVocabLS: (state, actions: PayloadAction<VocObj>) => {
      state.allUserVocabs = state.allUserVocabs.map((voc) => {
        if (voc.id === actions.payload.id) {
          return actions.payload;
        } else return voc;
      });
      state.lastUpdate = Date.now();
    },
    removeVocFromLS: (state, actions: PayloadAction<string>) => {
      const newArr = state.allUserVocabs.filter(
        (voc) => voc.id !== actions.payload
      );
      state.allUserVocabs = newArr;
      state.lastUpdate = Date.now();
    },
    addWorkbook: (state, actions: PayloadAction<WorkbookType>) => {
      state.workbooks.push(actions.payload);
      state.lastUpdate = Date.now();
    },
    removeWorkbook: (state, actions: PayloadAction<WorkbookType>) => {
      state.workbooks = state.workbooks.filter(
        (wb) => wb.id !== actions.payload.id
      );

      state.lastUpdate = Date.now();
    },
    addCategory: (state, actions: PayloadAction<{ label: string }>) => {
      state.categories.push(actions.payload.label);
      state.lastUpdate = Date.now();
    },
    removeCategory: (state, actions: PayloadAction<{ label: string }>) => {
      const index = state.categories.findIndex(
        (el) => el === actions.payload.label
      );
      if (index) state.categories.splice(index, 1);
      state.lastUpdate = Date.now();
    },
    changeCurLang: (state, actions: PayloadAction<string>) => {
      state.currentLang = actions.payload;
    },
    changeNativeLang: (state, actions: PayloadAction<string>) => {
      state.nativeLang = actions.payload;
    },
    addSavedLang: (
      state,
      actions: PayloadAction<{ lang: string; data: VocObj[] }>
    ) => {
      state.savedDbLangs.push(actions.payload.lang);
      state.dataVocStore[actions.payload.lang] = actions.payload.data;
    },
  },
});

export const {
  setVocabs,
  addVocab,
  updateVocabLS,
  removeVocFromLS,
  addWorkbook,
  addCategory,
  removeCategory,
  removeWorkbook,
  changeCurLang,
  changeNativeLang,
  addSavedLang,
} = VocabSlice.actions;

export default VocabSlice.reducer;
