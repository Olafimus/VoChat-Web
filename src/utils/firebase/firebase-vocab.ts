import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { VocObj, WorkbookType } from "../../logic/types/vocab.types";
import { nanoid } from "@reduxjs/toolkit";

const vocCol = collection(db, "vocabs");
const preVocCol = collection(db, "preDataVocabs");

export const addVocToDb = async (voc: VocObj) => {
  await setDoc(doc(vocCol), { ...voc });
};
export const getAllVocsDb = async (id: string) => {
  const q = query(vocCol, where("owner", "==", id));
  const snap = await getDocs(q);
  const vocs: VocObj[] = [];
  snap.forEach((doc) => {
    const voc: VocObj = {
      owner: doc.data().owner,
      id: doc.data().id,
      createdAt: doc.data().createdAt,
      vocLanguage: doc.data().vocLanguage,
      transLanguage: doc.data().transLanguage,
      vocab: doc.data().vocab,
      translation: doc.data().translation,
      pronunciation: doc.data().pronunciation,
      hints: doc.data().hints,
      categories: doc.data().categories,
      workbooks: doc.data().workbooks,
      setImportance: doc.data().setImportance,
      calcImportance: doc.data().calcImportance,
      learnHistory: doc.data().learnHistory,
      score: doc.data().score,
      favored: doc.data().favored,
      favoredAt: doc.data().favoredAt,
      lastUpdated: doc.data().lastUpdated,
      checkStatus: doc.data().checkStatus,
    };
    vocs.push(voc);
  });
  return vocs;
};

export const deleteVocDb = async (id: string, uid: string) => {
  const q = query(vocCol, where("id", "==", id), where("owner", "==", uid));
  const snap = await getDocs(q);
  let ref: string | undefined = snap.docs[0].ref.id;
  if (ref) deleteDoc(doc(vocCol, ref));
};

export const updateVocDb = async (voc: VocObj, uid: string) => {
  const q = query(vocCol, where("id", "==", voc.id), where("owner", "==", uid));
  const snap = await getDocs(q);
  console.log(voc);
  let ref: string | undefined = snap.docs[0].ref.id;
  if (ref) updateDoc(doc(vocCol, ref), { ...voc });
};

export const loadPreVocs = async (
  lang: string,
  wbs: WorkbookType[],
  uid: string
) => {
  const searchString = `preData${lang}InEnglish`;
  const q = query(preVocCol, where("owner", "==", searchString));
  const snap = await getDocs(q);
  const vocs: VocObj[] = [];
  snap.forEach((doc) => {
    const workbooks: WorkbookType[] = [];
    const levels = ["A1", "A2", "B1", "B2"];
    levels.forEach((level) => {
      if (doc.data().categories.includes(level)) {
        let wb = wbs.find((wb) => wb.name === level);
        if (wb) workbooks.push(wb);
        else
          workbooks.push({
            owner: uid,
            name: level,
            id: nanoid(),
            vocCount: undefined,
            vocLanguage: doc.data().vocLanguage,
            transLanguage: doc.data().transLanguage,
            score: 0,
            createdAt: Date.now(),
            createdBy: uid,
            lastUpdated: Date.now(),
            lastLearned: 0,
          });
      }
    });

    const voc: VocObj = {
      owner: doc.data().owner,
      id: doc.data().id,
      createdAt: doc.data().createdAt,
      vocLanguage: doc.data().vocLanguage,
      transLanguage: doc.data().transLanguage,
      vocab: doc.data().translation,
      translation: doc.data().vocab,
      pronunciation: doc.data().pronunciation || [],
      hints: doc.data().hints || [],
      categories: doc.data().categories,
      workbooks,
      setImportance: doc.data().setImportance,
      calcImportance: doc.data().calcImportance,
      learnHistory: doc.data().learnHistory,
      score: doc.data().score,
      favored: doc.data().favored,
      favoredAt: doc.data().favoredAt,
      lastUpdated: doc.data().lastUpdated,
      checkStatus: doc.data().checkStatus,
    };
    vocs.push(voc);
  });
  return vocs;
};
