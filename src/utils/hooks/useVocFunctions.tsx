import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  setCompleted,
  setCurLearnVocabs,
  setRoundFinished,
  startNextLearnRound,
} from "../../app/slices/learning-slice";
import { updateVocabLS } from "../../app/slices/vocabs-slice";
import { Vocab } from "../../logic/classes/vocab.class";
import { updateVocDb } from "../firebase/firebase-vocab";

export const useVocFunctions = () => {
  const dispatch = useAppDispatch();
  const { id: uid } = useAppSelector((s) => s.user);
  const {
    round,
    roundFinished,
    completed,
    currentVocabs,
    checkedCount,
    currentResults,
    vocabs,
  } = useAppSelector((s) => s.learning);

  const startAgain = () => {
    vocabs.forEach((voc) => voc.resetStatus());
    dispatch(setCurLearnVocabs(vocabs));
    dispatch(setCompleted(false));
    dispatch(setRoundFinished(false));
  };

  const retryMistakes = () => {
    const newVocArr: Vocab[] = [];
    vocabs.forEach((voc) => {
      if (voc.getResult() === false) newVocArr.push(voc);
    });
    if (newVocArr.length === 0) {
      vocabs.forEach((voc) => voc.resetStatus());
      dispatch(setCompleted(true));
    }
    newVocArr.forEach((voc) => voc.resetStatus());
    dispatch(setCurLearnVocabs(newVocArr));
    dispatch(startNextLearnRound());
  };

  const updateVocabs = () => {
    currentVocabs.forEach((voc) => {
      const result = voc.getResult();
      voc.addLearnHis(result).calcScore(result).calcImp(5);
      const vocObj = voc.getVocObj();
      dispatch(updateVocabLS(vocObj));
      updateVocDb(vocObj, uid);
    });
  };

  useEffect(() => {
    if (!roundFinished) return;
    // updateVocabs();
    console.log("finished: ", roundFinished);
  }, [roundFinished]);

  return { startAgain, retryMistakes, updateVocabs };
};
