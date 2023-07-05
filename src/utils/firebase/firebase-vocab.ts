import { doc } from "firebase/firestore";
import { VocObj } from "../../logic/types/vocab.types";
import { db } from "../firebase";

export const addvocabToDb = async (ref: string, voc: VocObj) => {
  const vocRef = doc(db, "vocabs", ref);
};
