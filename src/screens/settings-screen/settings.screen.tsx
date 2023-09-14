import React, { useEffect, useState } from "react";
import Push from "push.js";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import { notifyUser } from "../../utils/notification";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { AllVocabsClass } from "../../logic/classes/vocab.class";
import { updateVocabLS } from "../../app/slices/vocabs-slice";
import {
  loadLastUpdated,
  loadPreVocs,
} from "../../utils/firebase/firebase-vocab";
import { addDicVocs, addVocToPre } from "../../utils/firebase/uploadPreData";

const SettingsScreen = () => {
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  // const [vocs, setVocs] = useState<AllVocabsClass>([]);
  const dispatch = useAppDispatch();

  const testing = async () => {
    console.log(allVocabs.getDefaultVocs(5));
  };

  const loading = async () => {
    // const data = await loadPreVocs("German", workbooks, uid);
    loadLastUpdated(uid);
  };

  // useEffect(() => {
  //   setVocs(allVocabs);
  // }, [allVocabs]);
  // console.log(vocs.getDefaultVocs(5)[0].calcImp(5));
  const handleClick = () => {
    // Push.create("a push");

    toast("so easy", {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "light",
    });
  };
  return (
    <>
      <div>
        SettingsScreen
        <p>teest</p>
        <p>teest</p>
        <p>teest</p>
        <p>teest</p>
        <button onClick={loading}>load</button>
        <button onClick={testing}>upload</button>
        <button onClick={handleClick}>toast</button>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      ></ToastContainer>
    </>
  );
};

export default SettingsScreen;
