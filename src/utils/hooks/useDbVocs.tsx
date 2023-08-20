import { useState, useEffect } from "react";
import { loadPreVocs } from "../firebase/firebase-vocab";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setDataVocs, setDbLang } from "../../app/slices/vocabs-class-slice";
import { dbLangObj } from "../../assets/constants/db-lang-obj";
import { addSavedLang } from "../../app/slices/vocabs-slice";

export const useDbVocs = (
  handleClose: () => void
): [
  (val: null | keyof typeof dbLangObj) => void,
  (val: null | AllVocabsClass) => void
] => {
  const dispatch = useAppDispatch();
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  const { dbLang } = useAppSelector((state) => state.allVocabs);
  const { dataVocStore, savedDbLangs } = useAppSelector(
    (state) => state.vocabs
  );

  // const [dataVocs, setDataVocs] = useState<null | AllVocabsClass>(null);
  // const [dbLang, setDbLang] = useState<null | string>(null);

  const changeLang = (val: null | keyof typeof dbLangObj) => {
    dispatch(setDbLang(val));
  };
  const changeDbVocs = (val: null | AllVocabsClass) => {
    dispatch(setDataVocs(val));
  };

  const handleDbLoad = async (lang: string) => {
    try {
      const data = await loadPreVocs(lang, workbooks, uid);
      const newVocs = new AllVocabsClass([]);

      data.forEach((voc) => newVocs.addVocab(new Vocab(voc)));
      dispatch(setDataVocs(newVocs));
      dispatch(addSavedLang({ lang, data }));
      handleClose();
    } catch (error) {
      console.log(error);
      handleClose();
    }
  };

  const handleLocalLoad = (lang: string) => {
    const data = dataVocStore[lang] || [];
    const newVocs = new AllVocabsClass([]);
    data.forEach((voc) => newVocs.addVocab(new Vocab(voc)));
    dispatch(setDataVocs(newVocs));
  };

  useEffect(() => {
    if (!dbLang) return;
    savedDbLangs.includes(dbLang)
      ? handleLocalLoad(dbLang)
      : handleDbLoad(dbLang);
  }, [dbLang]);

  return [changeLang, changeDbVocs];
};
