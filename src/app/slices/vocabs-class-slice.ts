import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { VocObj } from "../../logic/types/vocab.types";
import { AllVocabsClass } from "../../logic/classes/vocab.class";

interface VocabClassState {
  allVocabs: AllVocabsClass;
}

const initialState: VocabClassState = {
  allVocabs: new AllVocabsClass([]),
};

const allVocabsSlice = createSlice({
  name: "allVocabs",
  initialState,
  reducers: {
    setAllVocabs: (state, actions: PayloadAction<AllVocabsClass>) => {
      state.allVocabs = actions.payload;
    },
  },
});

export const { setAllVocabs } = allVocabsSlice.actions;

export default allVocabsSlice.reducer;
