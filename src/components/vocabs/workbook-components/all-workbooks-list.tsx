import React, { memo, useState } from "react";
import { useMediaQuery, Button, Box, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import WorkbooksColumnSection from "./workbook-column-section";
import {
  addWorkbook,
  removeWorkbook,
  updateVocabLS,
} from "../../../app/slices/vocabs-slice";
import ManageWorkbook from "./manage-workbook-dialog";
import { WorkbookType } from "../../../logic/types/vocab.types";
import { getAllWbsDb } from "../../../utils/firebase/firebase-workbooks";

const WorkbookCardList = ({
  searchString,
  render,
}: {
  searchString: string;
  render: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const [columnCount, setColumnCount] = React.useState(1);
  const [filteredWbs, setFilteredWbs] = React.useState<WorkbookType[]>([]);
  const columnArr = [1, 2, 3, 4, 5];
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  const matchesOne = useMediaQuery("(min-width:750px)");
  const matchesTwo = useMediaQuery("(min-width:1075px)");
  const matchesThree = useMediaQuery("(min-width:1400px)");

  React.useLayoutEffect(() => {
    const filWorkbooks = workbooks.filter((wb) =>
      wb.name.includes(searchString)
    );
    setFilteredWbs(filWorkbooks);
  }, [searchString, workbooks.length]);

  React.useEffect(() => {
    if (!matchesOne) {
      return setColumnCount(1);
    }
    if (matchesOne) setColumnCount(2);
    if (matchesTwo) setColumnCount(3);
    if (matchesThree) setColumnCount(4);
  }, [matchesOne, matchesTwo, matchesThree]);

  const loadWorkbooks = async () => {
    const wbs = await getAllWbsDb(uid);
    console.log(wbs);
    wbs.forEach((wb) => dispatch(addWorkbook(wb)));
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Workbook</Button>
      {workbooks.length < 1 && (
        <Box>
          <Typography>No workbooks on this device</Typography>
          <Typography>
            If you have workbooks, try to{" "}
            <Button sx={{ px: 0, mx: 0 }} size="small" onClick={loadWorkbooks}>
              Load
            </Button>{" "}
            them!
          </Typography>
        </Box>
      )}
      <div id="all-vocs-container" className="vocab-card-list-container">
        {columnArr.slice(0, columnCount).map((colNum) => (
          <WorkbooksColumnSection
            num={colNum}
            max={columnCount}
            wbs={filteredWbs}
            key={colNum}
          />
        ))}
      </div>

      <ManageWorkbook
        open={open}
        onClose={() => setOpen(false)}
        keepMounted={false}
      />
    </>
  );
};

export default WorkbookCardList;
