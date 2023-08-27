import { useState, useEffect } from "react";
import { loadDicVocs, loadPreVocs } from "../firebase/firebase-vocab";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setDataVocs, setDbLang } from "../../app/slices/vocabs-class-slice";
import { dbLangObj } from "../../assets/constants/db-lang-obj";
import { addSavedLang } from "../../app/slices/vocabs-slice";
import { changeVocScreenSetting } from "../../app/slices/settings-slice";

export const useDbVocs = (
  handleClose: () => void
): [
  (val: null | keyof typeof dbLangObj) => void,
  (val: null | AllVocabsClass) => void,
  (val: boolean) => void
] => {
  const dispatch = useAppDispatch();
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  const { dbLang } = useAppSelector((state) => state.allVocabs);
  const { vocabScreenSettings } = useAppSelector((s) => s.settings);
  const { dataVocStore, savedDbLangs } = useAppSelector(
    (state) => state.vocabs
  );
  const setLoading = (val: boolean) => {
    dispatch(changeVocScreenSetting({ ...vocabScreenSettings, loading: val }));
  };

  const changeLang = (val: null | keyof typeof dbLangObj) => {
    dispatch(setDbLang(val));
  };
  const changeDbVocs = (val: null | AllVocabsClass) => {
    dispatch(setDataVocs(val));
  };

  const handleDbLoad = async (lang: string) => {
    setLoading(true);
    try {
      console.log(lang);
      const data = lang.includes("Dic")
        ? await loadDicVocs(lang)
        : await loadPreVocs(lang, workbooks, uid);
      const newVocs = new AllVocabsClass([]);

      data.forEach((voc) => newVocs.addVocab(new Vocab(voc)));
      dispatch(setDataVocs(newVocs));
      dispatch(addSavedLang({ lang, data }));
      handleClose();
    } catch (error) {
      console.log(error);
      handleClose();
    }
    setLoading(false);
  };

  const handleLocalLoad = (lang: string) => {
    setLoading(true);
    const data = dataVocStore[lang] || [];
    const newVocs = new AllVocabsClass([]);
    data.forEach((voc) => newVocs.addVocab(new Vocab(voc)));
    dispatch(setDataVocs(newVocs));
    setLoading(false);
  };

  useEffect(() => {
    if (!dbLang) return;
    setLoading(true);
    console.log(savedDbLangs.includes(dbLang));
    savedDbLangs.includes(dbLang)
      ? handleLocalLoad(dbLang)
      : handleDbLoad(dbLang);
  }, [dbLang]);

  return [changeLang, changeDbVocs, setLoading];
};
