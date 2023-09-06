import React, { useState, useEffect } from "react";
import { AllVocabsClass, Vocab } from "../../../logic/classes/vocab.class";
import { useMediaQuery, Typography, Button } from "@mui/material";
import VocabColumnSection from "./vocab-column-section";
import { VocObj, WorkbookType } from "../../../logic/types/vocab.types";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { getAllVocsDb } from "../../../utils/firebase/firebase-vocab";
import {
  addVocab,
  addCategory,
  addWorkbook,
} from "../../../app/slices/vocabs-slice";
import { setAllVocabs } from "../../../app/slices/vocabs-class-slice";
import { useVocFilter } from "../../../utils/hooks/useVocFilter";
// import { addWorkbook } from "../../../app/slices/vocabs-slice";

const VocabCardList = ({
  allVocs,
  dataVocs,
  searchString,
  render,
  page,
}: {
  allVocs: AllVocabsClass;
  dataVocs: AllVocabsClass | null;
  searchString: string;
  render: boolean;
  page: number;
}) => {
  const dispatch = useAppDispatch();
  const [columnCount, setColumnCount] = React.useState(1);
  const [loading, setLoading] = useState(true);
  const columnArr = [1, 2, 3, 4, 5];
  const matchesOne = useMediaQuery("(min-width:750px)");
  const matchesTwo = useMediaQuery("(min-width:1075px)");
  const matchesThree = useMediaQuery("(min-width:1400px)");
  const { id: uid } = useAppSelector((state) => state.user);
  const { workbooks, categories } = useAppSelector((state) => state.vocabs);

  const [filteredVocs, check] = useVocFilter(
    allVocs,
    dataVocs,
    searchString,
    render
  );

  const loadVocs = async () => {
    try {
      const vocs: VocObj[] = await getAllVocsDb(uid);

      const newAllVocabs = new AllVocabsClass([]);
      if (vocs.length < 1) return;
      console.log(vocs);
      const wbs: WorkbookType[] = [];
      const cats: string[] = [];
      const wbIds: string[] = workbooks.map((wb) => wb.id);
      vocs.forEach((voc) => {
        if (!voc.workbooks) return;
        newAllVocabs.addVocab(new Vocab(voc));
        voc.workbooks.forEach((wb) => {
          if (!wbIds.includes(wb.id)) {
            wbIds.push(wb.id);
            wbs.push(wb);
          }
        });
        voc.categories.forEach((cat) => {
          if (!categories.includes(cat) && !cats.includes(cat)) cats.push(cat);
        });
        dispatch(addVocab(voc));
      });
      wbs.forEach((wb) => dispatch(addWorkbook(wb)));
      cats.forEach((cat) => dispatch(addCategory({ label: cat })));
      dispatch(setAllVocabs(newAllVocabs));
    } catch (error) {
      console.log(error);
    }
  };

  if (dataVocs === null && allVocs.getVocCount() < 1) loadVocs();

  useEffect(() => {
    // setLoading(true);
    if (!matchesOne) setColumnCount(1);
    if (matchesOne) setColumnCount(2);
    if (matchesTwo) setColumnCount(3);
    if (matchesThree) setColumnCount(4);
    setLoading(false);
  }, [matchesOne, matchesTwo, matchesThree]);

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
        {columnArr.slice(0, columnCount).map((colNum) => (
          <VocabColumnSection
            num={colNum + columnCount * (page - 1)}
            max={columnCount}
            vocabs={filteredVocs}
            key={colNum}
            loading={loading}
          />
        ))}
      </div>
    </>
  );
};

export default VocabCardList;
