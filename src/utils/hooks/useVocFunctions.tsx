import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  resetLearnSlice,
  setCompleted,
  setCurLearnVocabs,
  setLearnStart,
  setLearnVocabs,
  setRoundFinished,
  setRoute,
  startNextLearnRound,
} from "../../app/slices/learning-slice";
import { updateVocabLS } from "../../app/slices/vocabs-slice";
import { Vocab } from "../../logic/classes/vocab.class";
import { updateVocDb } from "../firebase/firebase-vocab";
import { useNavigate } from "react-router-dom";

export const useVocFunctions = (setValue: Dispatch<SetStateAction<number>>) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id: uid } = useAppSelector((s) => s.user);
  const { allVocabs } = useAppSelector((s) => s.allVocabs);
  const { vocabLearnSettings } = useAppSelector((state) => state.settings);
  const { activeLang, vocabs, currentVocabs } = useAppSelector(
    (s) => s.learning
  );

  const startAgain = () => {
    vocabs.forEach((voc) => voc.resetStatus());
    dispatch(setCurLearnVocabs({ vocs: vocabs, withStarted: true }));
    dispatch(setCompleted(false));
    dispatch(startNextLearnRound());
    setValue(0);
  };

  const startNewDefault = () => {
    const vocs = allVocabs.getDefaultVocs(
      activeLang,
      vocabLearnSettings.defaultVocCount,
      vocabLearnSettings.vocabTimeOut,
      vocabLearnSettings.rethrowMistakes
    );
    dispatch(resetLearnSlice());
    dispatch(setLearnVocabs(vocs));
    dispatch(setCurLearnVocabs({ vocs, withStarted: false }));
    dispatch(setRoute("default"));
    dispatch(setLearnStart(true));
    navigate("/vocab/learning/default");
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

  const retryMistakes = () => {
    const newVocArr: Vocab[] = [];
    vocabs.forEach((voc) => {
      if (voc.getResult() === false) newVocArr.push(voc);
    });
    if (newVocArr.length === 0) {
      dispatch(setCompleted(true));
    }
    vocabs.forEach((voc) => voc.resetStatus());
    dispatch(setCurLearnVocabs({ vocs: newVocArr, withStarted: true }));
    dispatch(startNextLearnRound());
    setValue(0);
  };

  // useEffect(() => {
  //   if (!roundFinished) return;
  //   updateVocabs();
  //   console.log("finished: ", roundFinished);
  // }, [roundFinished]);

  return { startAgain, retryMistakes, updateVocabs, startNewDefault };
};
