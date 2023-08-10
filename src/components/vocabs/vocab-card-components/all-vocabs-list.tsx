import React, { useState } from "react";
import { AllVocabsClass, Vocab } from "../../../logic/classes/vocab.class";
import { useMediaQuery, Typography, Button } from "@mui/material";
import VocabColumnSection from "./vocab-column-section";
import { VocObj } from "../../../logic/types/vocab.types";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { getAllVocsDb } from "../../../utils/firebase/firebase-vocab";
import { addVocab } from "../../../app/slices/vocabs-slice";
import { setAllVocabs } from "../../../app/slices/vocabs-class-slice";

const VocabCardList = ({
  allVocs,
  dataVocs,
  searchString,
  render,
}: {
  allVocs: AllVocabsClass;
  dataVocs: AllVocabsClass | null;
  searchString: string;
  render: boolean;
}) => {
  const dispatch = useAppDispatch();
  const [columnCount, setColumnCount] = React.useState(1);
  const [loading, setLoading] = useState(true);
  const [filteredVocs, setFilteredVocs] = React.useState<Vocab[]>([]);
  const columnArr = [1, 2, 3, 4, 5];
  const matchesOne = useMediaQuery("(min-width:750px)");
  const matchesTwo = useMediaQuery("(min-width:1075px)");
  const matchesThree = useMediaQuery("(min-width:1400px)");
  const { id: uid } = useAppSelector((state) => state.user);

  const [check, setCheck] = useState(false);
  const loadVocs = async () => {
    const vocs: VocObj[] = await getAllVocsDb(uid);
    const newAllVocabs = new AllVocabsClass([]);
    if (vocs.length < 1) return;
    vocs.forEach((voc) => {
      newAllVocabs.addVocab(new Vocab(voc));
      dispatch(addVocab(voc));
    });
    console.log(newAllVocabs.getAllVocs());
    dispatch(setAllVocabs(newAllVocabs));
    setCheck(true);
  };

  React.useLayoutEffect(() => {
    if (allVocs.getVocCount() > 0 || dataVocs) setCheck(true);
    const vocArr = dataVocs
      ? dataVocs.getFilteredVoc(searchString)
      : allVocs.getFilteredVoc(searchString);
    if (!vocArr) return;
    setFilteredVocs(vocArr);
  }, [searchString, render, allVocs.getVocCount(), dataVocs]);

  React.useEffect(() => {
    if (!matchesOne) {
      return setColumnCount(1);
    }
    if (matchesOne) setColumnCount(2);
    if (matchesTwo) setColumnCount(3);
    if (matchesThree) setColumnCount(4);
    setLoading(false);
  }, [matchesOne, matchesTwo, matchesThree]);

  // console.log(dbLang, dataVocs);

  return (
    <>
      {!check && (
        <>
          <Typography variant="h6">No Vocabs yet!</Typography>
          <Typography variant="body2">
            If you have vocabs load them frome the Database!{" "}
            <Button onClick={loadVocs}>Load</Button>
          </Typography>
        </>
      )}
      <div id="all-vocs-container" className="vocab-card-list-container">
        {!loading &&
          columnArr
            .slice(0, columnCount)
            .map((colNum) => (
              <VocabColumnSection
                num={colNum}
                max={columnCount}
                vocabs={filteredVocs}
                key={colNum}
              />
            ))}
      </div>
    </>
  );
};

export default VocabCardList;
