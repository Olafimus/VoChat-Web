import React, { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
} from "@mui/material";
import { WorkbookType } from "../../logic/types/vocab.types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  setCurLearnVocabs,
  setLearnStart,
  setLearnVocabs,
  setRoute,
} from "../../app/slices/learning-slice";
import SearchField from "../../components/general/search-field";
import { useNavigate } from "react-router-dom";
import LearnTabs from "../../components/vocabs/learning/learning-tabbar";

const WorkbookRoute = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredWb, setFilteredWb] = useState<WorkbookType[]>([]);
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const [workbook, setWorkbook] = useState<null | string>(null);
  const { allVocabs } = useAppSelector((state) => state.allVocabs);

  useEffect(() => {
    const newWb = workbooks.filter((wb) => wb.name.includes(searchTerm));
    setFilteredWb(newWb);
  }, [searchTerm]);

  useEffect(() => {
    if (workbook) {
      const vocs = allVocabs.getWbVocs(workbook);
      dispatch(setCurLearnVocabs(vocs));
      dispatch(setLearnVocabs(vocs));
      dispatch(setRoute("workbook"));
    }
  }, [workbook]);

  const reset = () => {
    dispatch(setLearnStart(false));
    dispatch(setRoute(null));
    navigate("/vocab/learning");
  };

  return (
    <>
      {!workbook && (
        <Box>
          Test
          <Button onClick={reset}>Go Back</Button>
          <SearchField setSearchTerm={setSearchTerm} label="Search Workbook" />
          <List sx={{ maxHeight: "800", overflow: "auto" }}>
            {filteredWb.map((wb) => {
              const wbVocs = allVocabs.getWbVocs(wb.id);

              return (
                <ListItem
                  key={wb.id}
                  alignItems="center"
                  onClick={() => setWorkbook(wb.id)}
                >
                  <ListItemText
                    sx={{ textAlign: "center" }}
                    primary={wb.name}
                    secondary={`Vocabs: ${wbVocs.length}`}
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}
      {workbook && (
        <Box display={"flex"} justifyContent="center">
          <LearnTabs />
        </Box>
      )}
    </>
  );
};

export default WorkbookRoute;
