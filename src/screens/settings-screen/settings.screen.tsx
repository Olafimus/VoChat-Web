import React, { useEffect, useState } from "react";
import Push from "push.js";

import { notifyUser } from "../../utils/notification";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { AllVocabsClass } from "../../logic/classes/vocab.class";
import { updateVocabLS } from "../../app/slices/vocabs-slice";

const SettingsScreen = () => {
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const [vocs, setVocs] = useState<AllVocabsClass>([]);
  const dispatch = useAppDispatch();

  useEffect(() => {
    setVocs(allVocabs);
  }, [allVocabs]);
  // console.log(vocs.getDefaultVocs(5)[0].calcImp(5));
  const handleClick = async () => {
    Push.create("a push");
  };
  return (
    <div>
      SettingsScreen
      <button onClick={() => console.log(vocs.getDefaultVocs(10))}>
        testing
      </button>
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <button onClick={handleClick}>push</button>
    </div>
  );
};

export default SettingsScreen;
