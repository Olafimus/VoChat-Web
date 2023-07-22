import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Note } from "../../logic/types/note.types";
import {
  addNoteToDb,
  deleteNoteDb,
  updateNoteDb,
} from "../../utils/firebase/firebase-notes";

interface Notes {
  notes: Note[];
  sender: string[];
  curNoteLang: string;
  noteLangs: string[];
  // noteCreator: string[];
}

const initialState: Notes = {
  notes: [],
  sender: [],
  curNoteLang: "",
  noteLangs: [],
};

export const NoteSlice = createSlice({
  name: "NoteSlice",
  initialState,
  reducers: {
    addNote: (state, action: PayloadAction<Note>) => {
      const note = state.notes.find((note) => note.id === action.payload.id);
      if (note) return;
      state.notes.push(action.payload);
    },
    updateNote: (state, action: PayloadAction<{ note: Note; uid: string }>) => {
      const i = state.notes.findIndex(
        (note) => note.id === action.payload.note.id
      );
      if (i === undefined) return;
      state.notes[i] = action.payload.note;
      updateNoteDb(action.payload.note, action.payload.uid);
    },
    deleteNote: (state, action: PayloadAction<Note>) => {
      state.notes = state.notes.filter((note) => note.id !== action.payload.id);
      deleteNoteDb(action.payload.id);
    },
    switchNoteLang: (state, action: PayloadAction<string>) => {
      state.curNoteLang = action.payload;
    },
    addNoteLang: (state, action: PayloadAction<string>) => {
      if (state.noteLangs.includes(action.payload)) return;
      state.noteLangs.push(action.payload);
    },
    deleteNoteLang: (state, action: PayloadAction<string>) => {
      state.noteLangs = state.noteLangs.filter(
        (lang) => lang !== action.payload
      );
    },
  },
});

export const {
  addNote,
  updateNote,
  deleteNote,
  switchNoteLang,
  addNoteLang,
  deleteNoteLang,
} = NoteSlice.actions;

export default NoteSlice.reducer;
