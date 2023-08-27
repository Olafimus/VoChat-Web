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
// import { preData } from "../constants/predata";
import { db } from "../firebase";
// import { farsDics } from "../constants/farsDic";
import { VocObj } from "../../logic/types/vocab.types";

const vocCol = collection(db, "preDataVocabs");
const dicVocCol = collection(db, "dictionaryVocabs");

export const addVocToPre = async () => {
  const uploadVoc = async (voc: any) => {
    await setDoc(doc(vocCol), { ...voc });
  };
  // const vocabs = Object.values(preData);
  // vocabs.forEach((vocs) => vocs.forEach((voc) => uploadVoc(voc)));
  // const left = vocabs[6].slice(219, 3000);
  // console.log(left);
  // left.forEach((voc) => uploadVoc(voc));
  // console.log("6", vocabs, vocabs[6][0].owner);
};

export const addDicVocs = async () => {
  // const uploadVoc = async (voc: any) => {
  //   await setDoc(doc(dicVocCol), { ...voc });
  // };
  // farsDics.forEach((voc) => uploadVoc(voc));
};
