import React, { useEffect, useState } from "react";
import Push from "push.js";

import { notifyUser } from "../../utils/notification";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { AllVocabsClass } from "../../logic/classes/vocab.class";
import { updateVocabLS } from "../../app/slices/vocabs-slice";
import { loadPreVocs } from "../../utils/firebase/firebase-vocab";
import { addVocToPre } from "../../utils/firebase/uploadPreData";

const SettingsScreen = () => {
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  // const [vocs, setVocs] = useState<AllVocabsClass>([]);
  const dispatch = useAppDispatch();

  const testing = async () => {
    await addVocToPre();
  };

  const loading = async () => {
    const data = await loadPreVocs("German", workbooks, uid);
  };

  // useEffect(() => {
  //   setVocs(allVocabs);
  // }, [allVocabs]);
  // console.log(vocs.getDefaultVocs(5)[0].calcImp(5));
  const handleClick = async () => {
    Push.create("a push");
  };
  return (
    <div>
      SettingsScreen
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <button onClick={loading}>load</button>
      <button onClick={testing}>upload</button>
      <button onClick={handleClick}>push</button>
    </div>
  );
};

export default SettingsScreen;
