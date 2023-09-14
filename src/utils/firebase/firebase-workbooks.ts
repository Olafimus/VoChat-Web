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
import { WorkbookType } from "../../logic/types/vocab.types";

const wbCol = collection(db, "workbooks");

export const addWbToDb = async (wb: WorkbookType) => {
  await setDoc(doc(wbCol), { ...wb });
};
export const getAllWbsDb = async (id: string) => {
  const q = query(wbCol, where("owner", "==", id));
  const snap = await getDocs(q);
  const wbs: WorkbookType[] = [];
  snap.forEach((doc) => {
    const wb: WorkbookType = {
      owner: doc.data().owner,
      name: doc.data().name,
      id: doc.data().id,
      vocCount: doc.data().vocCount,
      vocLanguage: doc.data().vocLanguage,
      transLanguage: doc.data().transLanguage,
      score: doc.data().score,
      createdAt: doc.data().createdAt,
      createdBy: doc.data().createdBy,
      lastUpdated: doc.data().lastUpdated,
      lastLearned: doc.data().lastLearned,
    };
    wbs.push(wb);
  });
  return wbs;
};

export const deleteWbDb = async (id: string, uid: string) => {
  const q = query(wbCol, where("id", "==", id), where("owner", "==", uid));
  const snap = await getDocs(q);
  let ref: string | undefined = snap.docs[0].ref.id;
  if (ref) deleteDoc(doc(wbCol, ref));
};

export const updateWbDb = async (wb: WorkbookType, uid: string) => {
  const q = query(wbCol, where("id", "==", wb.id), where("owner", "==", uid));
  const snap = await getDocs(q);
  let ref: string | undefined = snap.docs[0].ref.id;
  if (ref) updateDoc(doc(wbCol, ref), { ...wb });
};
