import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Note } from "../../screens/notebook-screen/notebook-screen";

interface Notes {
  notes: Note[];
  sender: string[];
}

const initialState: Notes = {
  notes: [],
  sender: [],
};

export const NoteSlice = createSlice({
  name: "NoteSlice",
  initialState,
  reducers: {
    addNote: (state, action: PayloadAction<Note>) => {
      state.notes.push(action.payload);
    },
    updateNote: (state, action: PayloadAction<Note>) => {
      const i = state.notes.findIndex((note) => note.id === action.payload.id);
      if (i === undefined) return;
      state.notes[i] = action.payload;
    },
    deleteNote: (state, action: PayloadAction<Note>) => {
      state.notes = state.notes.filter((note) => note.id !== action.payload.id);
    },
  },
});

export const { addNote, updateNote, deleteNote } = NoteSlice.actions;

export default NoteSlice.reducer;
