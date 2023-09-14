import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { Note } from "../../logic/types/note.types";

const noteCol = collection(db, "notes");

export const addNoteToDb = async (note: Note) => {
  await setDoc(doc(noteCol), { ...note });
};
export const getAllNotes = async (id: string) => {
  const q = query(noteCol, where("owner", "==", id), orderBy("sendTime"));
  const snap = await getDocs(q);
  const data: Note[] = [];
  snap.forEach((doc) => {
    const note: Note = {
      owner: doc.data().owner,
      id: doc.data().id,
      savedTime: doc.data().savedTime,
      sender: doc.data().sender,
      sendTime: doc.data().sendTime,
      message: doc.data().message,
      note: doc.data().note || [],
      language: doc.data().language,
      checked: doc.data().checked,
      delete: false,
      type: doc.data().type,
      date: doc.data().date,
    };
    data.push(note);
  });
  return data;
};

export const deleteNoteDb = async (id: string) => {
  const q = query(noteCol, where("id", "==", id));
  const snap = await getDocs(q);
  let ref: string | undefined = snap.docs[0].ref.id;
  if (ref) deleteDoc(doc(noteCol, ref));
};

export const updateNoteDb = async (note: Note, uid: string) => {
  const q = query(
    noteCol,
    where("id", "==", note.id),
    where("owner", "==", uid)
  );
  const snap = await getDocs(q);
  let ref: string | undefined = snap.docs[0].ref.id;
  if (ref) updateDoc(doc(noteCol, ref), { ...note });
};
