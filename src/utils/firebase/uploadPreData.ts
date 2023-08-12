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
import { preData } from "../constants/predata";
import { db } from "../firebase";
import { VocObj } from "../../logic/types/vocab.types";

const vocCol = collection(db, "preDataVocabs");

export const addVocToPre = async () => {
  // console.log(preData);
  const uploadVoc = async (voc) => {
    await setDoc(doc(vocCol), { ...voc });
  };
  const vocabs = Object.values(preData);
  // vocabs.forEach((vocs) => vocs.forEach((voc) => uploadVoc(voc)));
  // vocabs[6].forEach((voc) => uploadVoc(voc));
  // console.log("6", vocabs[6]);
};
