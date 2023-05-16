import React, { memo } from "react";
import { AllVocabsClass, Vocab } from "../../../logic/classes/vocab.class";
import { useMediaQuery } from "@mui/material";
import VocabColumnSection from "./vocab-column-section";

const VocabCardList = ({
  allVocs,
  searchString,
  render,
}: {
  allVocs: AllVocabsClass;
  searchString: string;
  render: boolean;
}) => {
  const [columnCount, setColumnCount] = React.useState(1);
  const [filteredVocs, setFilteredVocs] = React.useState<Vocab[]>([]);
  const columnArr = [1, 2, 3, 4, 5];
  const matchesOne = useMediaQuery("(min-width:750px)");
  const matchesTwo = useMediaQuery("(min-width:1075px)");
  const matchesThree = useMediaQuery("(min-width:1400px)");

  React.useLayoutEffect(() => {
    const vocArr = allVocs.getFilteredVoc(searchString);
    if (!vocArr) return;
    setFilteredVocs(vocArr);
  }, [searchString, render, allVocs.getVocCount()]);

  React.useEffect(() => {
    if (!matchesOne) {
      return setColumnCount(1);
    }
    if (matchesOne) setColumnCount(2);
    if (matchesTwo) setColumnCount(3);
    if (matchesThree) setColumnCount(4);
  }, [matchesOne, matchesTwo, matchesThree]);

  return (
    <div id="all-vocs-container" className="vocab-card-list-container">
      {columnArr.slice(0, columnCount).map((colNum) => (
        <VocabColumnSection
          num={colNum}
          max={columnCount}
          vocabs={filteredVocs}
          key={colNum}
        />
      ))}
    </div>
  );
};

export default VocabCardList;
