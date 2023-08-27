import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { VocObj } from "../../logic/types/vocab.types";
import { AllVocabsClass } from "../../logic/classes/vocab.class";
import { dbLangObj } from "../../assets/constants/db-lang-obj";

type dbLangKeys = keyof typeof dbLangObj;
interface VocabClassState {
  allVocabs: AllVocabsClass;
  dbLang: keyof typeof dbLangObj | null;
  dataCategories: string[];
  // vocHeaderTitle: "Y"
  dataVocs: AllVocabsClass | null;
}

const initialState: VocabClassState = {
  allVocabs: new AllVocabsClass([]),
  dataVocs: null,
  dbLang: null,
  dataCategories: [],
};

const allVocabsSlice = createSlice({
  name: "allVocabs",
  initialState,
  reducers: {
    setAllVocabs: (state, actions: PayloadAction<AllVocabsClass>) => {
      state.allVocabs = actions.payload;
    },
    setDataVocs: (state, actions: PayloadAction<AllVocabsClass | null>) => {
      state.dataVocs = actions.payload;
      if (!actions.payload) return;
      const categories = actions.payload.getCategories();
      state.dataCategories = categories;
    },
    setDbLang: (s, a: PayloadAction<keyof typeof dbLangObj | null>) => {
      s.dbLang = a.payload;
    },
  },
});

export const { setAllVocabs, setDataVocs, setDbLang } = allVocabsSlice.actions;

export default allVocabsSlice.reducer;
