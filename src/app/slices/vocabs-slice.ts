import { createSlice } from "@reduxjs/toolkit";
import { VocObj } from "../../logic/types/vocab.types";

interface VocabState {
  allvocabs: VocObj[];
}

const initialState: VocabState = {
  allvocabs: [],
};

export const VocabSlice = createSlice({
  name: "Vocab State",
  initialState,
  reducers: {
    setVocabs: (state, { payload }) => {
      state.allvocabs = payload;
    },
    addVocab: (state, { payload }) => {
      state.allvocabs.push(payload);
    },
  },
});

export const { setVocabs, addVocab } = VocabSlice.actions;

export default VocabSlice.reducer;
