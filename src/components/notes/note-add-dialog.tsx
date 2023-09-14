import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { supportedLanguages as languages } from "../../utils/country-flags";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  addNote,
  addNoteLang,
  switchNoteLang,
  updateNote,
} from "../../app/slices/notes-slice";
import { nanoid } from "@reduxjs/toolkit";
import { Note } from "../../logic/types/note.types";
import { addNoteToDb } from "../../utils/firebase/firebase-notes";

const NoteAddDialog = ({
  openAdd,
  setOpenAdd,
  note,
  text = null,
  creatorId,
  language,
}: {
  openAdd: boolean;
  setOpenAdd: (val: boolean) => void;
  note?: Note;
  text?: string | null;
  creatorId?: string;
  language?: string;
}) => {
  const dispatch = useAppDispatch();
  const [lang, setLang] = useState("");
  const [creator, setCreator] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const { curNoteLang } = useAppSelector((state) => state.notes);
  const { currentLang } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);

  const handleClose = () => {
    setOpenAdd(false);
  };

  useEffect(() => {
    if (curNoteLang === "") setLang(currentLang);
    setLang(curNoteLang);
    setNewNote("");
    setCreator(uid);
    setNewExplanation("");
    if (text) setNewNote(text);
    if (creatorId) return setCreator(creatorId);
    if (!note) return;
    setNewNote(note.message.join("\n"));
    setLang(note.language);
    if (note.note) setNewExplanation(note.note.join("\n"));
  }, [note, uid, text]);

  return (
    <Dialog fullWidth maxWidth="md" onClose={handleClose} open={openAdd}>
      <DialogTitle textAlign="center">Add a Note</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value as string)}
          sx={{ p: 1, mt: 1 }}
          label="Note-Text"
        />
        <TextField
          fullWidth
          multiline
          value={newExplanation}
          minRows={2}
          maxRows={4}
          onChange={(e) => setNewExplanation(e.target.value as string)}
          sx={{ p: 1, mt: 1 }}
          label="Explanations"
        />
        <Box display="flex" flexDirection="row" p={1}>
          <FormControl sx={{ minWidth: 175, mx: 1 }}>
            <InputLabel variant="standard" size="small">
              Note Language
            </InputLabel>
            <Select
              variant="standard"
              id="cur-trans-lang"
              size="small"
              label="Translation Language"
              value={lang}
              onChange={(e) => {
                setLang(e.target.value as string);
                dispatch(switchNoteLang(e.target.value as string));
              }}
            >
              {languages.map((lang) => (
                <MenuItem key={lang[0]} value={lang[0]}>
                  {lang[1] + " " + lang[0]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            disabled={currentLang === lang ? true : false}
            onClick={() => {
              setLang(currentLang);
              dispatch(switchNoteLang(currentLang));
            }}
          >
            Set to {currentLang}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button sx={{ color: "#bdbdbd" }} onClick={() => setOpenAdd(false)}>
          Close
        </Button>
        <Button
          disabled={newNote.length > 3 ? false : true}
          onClick={() => {
            const message = newNote.split("\n");
            const expl =
              newExplanation.length > 0 ? newExplanation.split("\n") : [];
            // return;
            const id = nanoid();
            if (note) {
              const upNote: Note = {
                ...note,
                message,
                note: expl,
                language: lang,
                savedTime: Date.now(),
              };
              dispatch(updateNote({ note: upNote, uid }));
            } else {
              const noteAdd: Note = {
                owner: uid,
                id,
                type: "message",
                language: curNoteLang,
                message,
                checked: false,
                note: expl,
                sender: creator,
                sendTime: Date.now(),
                savedTime: Date.now(),
                date: new Date(Date.now()).toLocaleDateString(),
              };
              dispatch(addNote(noteAdd));
              addNoteToDb(noteAdd);
            }
            dispatch(addNoteLang(lang));
            setOpenAdd(false);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NoteAddDialog;
