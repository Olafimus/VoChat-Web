import { useState, useEffect, useLayoutEffect } from "react";
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
import { useParams } from "react-router-dom";
import { useColumns } from "../../../utils/hooks/useColumns";

const WorkbookCardList = ({
  searchString,
  render,
}: {
  searchString: string;
  render: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const params = useParams();
  const [filteredWbs, setFilteredWbs] = useState<WorkbookType[]>([]);
  const [workbook, setWorkbook] = useState<WorkbookType | null>(null);
  const columnArr = [1, 2, 3, 4, 5];
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  const [columnCount] = useColumns();

  useLayoutEffect(() => {
    const filWorkbooks = workbooks.filter((wb) =>
      wb.name.includes(searchString)
    );
    setFilteredWbs(filWorkbooks);
  }, [searchString, workbooks.length]);

  useEffect(() => {
    const wb = params.id && workbooks.find((wb) => wb.id === params.id);
    // console.log(wb);
    if (!wb) return;
    setWorkbook(wb);
    setOpen(true);
  }, [params]);

  const loadWorkbooks = async () => {
    const wbs = await getAllWbsDb(uid);
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
        wb={workbook ? workbook : undefined}
        onClose={() => setOpen(false)}
        keepMounted={false}
      />
    </>
  );
};

export default WorkbookCardList;
