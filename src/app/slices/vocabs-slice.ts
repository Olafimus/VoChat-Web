import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { VocObj } from "../../logic/types/vocab.types";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";

interface VocabState {
  allvocabs: AllVocabsClass;
}

const initialState: VocabState = {
  allvocabs: new AllVocabsClass([]),
};

export const VocabSlice = createSlice({
  name: "Vocab State",
  initialState,
  reducers: {
    setVocabs: (state, { payload }) => {
      state.allvocabs = payload;
    },
    addVocab: (state, actions: PayloadAction<Vocab>) => {
      state.allvocabs.addVocab(actions.payload);
    },
  },
});

export const { setVocabs, addVocab } = VocabSlice.actions;

export default VocabSlice.reducer;
