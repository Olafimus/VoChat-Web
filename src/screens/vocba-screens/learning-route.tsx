import React, { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Vocab } from "../../logic/classes/vocab.class";
import LearnTabs from "../../components/vocabs/learning/learning-tabbar";
import SearchField from "../../components/general/search-field";
import { WorkbookType } from "../../logic/types/vocab.types";
import {
  setCurLearnVocabs,
  setLearnStart,
  setLearnVocabs,
  setRoute,
} from "../../app/slices/learning-slice";

export type LearnRoutes = "default" | "workbook" | "random" | "mistakes" | null;

const LearningRoute = () => {
  const { route } = useParams();
  const dispatch = useAppDispatch();
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { vocabLearnSettings } = useAppSelector((state) => state.settings);
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { started } = useAppSelector((state) => state.learning);
  // const [learnVocs, setLearnVocs] = useState<Vocab[]>([]);
  const [workbook, setWorkbook] = useState<null | string>(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("fired");
    if (started) return;
    if (route === "default") {
      // setLearnVocs(
      //   allVocabs.getDefaultVocs(vocabLearnSettings.defaultVocCount, 5)
      // );
      const vocs = allVocabs.getDefaultVocs(
        vocabLearnSettings.defaultVocCount,
        5
      );
      dispatch(setLearnVocabs(vocs));
      dispatch(setCurLearnVocabs(vocs));
      dispatch(setRoute("default"));
      dispatch(setLearnStart(true));
    }
    if (route === "workbook" && workbook) {
      const vocs = allVocabs.getWbVocs(workbook);
      dispatch(setCurLearnVocabs(vocs));
      dispatch(setLearnVocabs(vocs));
      dispatch(setRoute("workbook"));
    }
    // dispatch(setLearnStart(true));
  }, [route, workbook]);

  const DefaultRoute = () => {
    return (
      <Box display={"flex"} justifyContent="center">
        <LearnTabs />
      </Box>
    );
  };

  const reset = () => {
    dispatch(setLearnStart(false));
    dispatch(setRoute(null));
    navigate("/vocab/learning");
  };

  const WorkbookRoute = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredWb, setFilteredWb] = useState<WorkbookType[]>([]);

    useEffect(() => {
      const newWb = workbooks.filter((wb) => wb.name.includes(searchTerm));
      setFilteredWb(newWb);
    }, [searchTerm]);

    return (
      <>
        {!workbook && (
          <Box>
            Test
            <Button onClick={reset}>Go Back</Button>
            <SearchField
              setSearchTerm={setSearchTerm}
              label="Search Workbook"
            />
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
  return (
    <>
      {route === "default" && <DefaultRoute />}
      {route === "workbook" && <WorkbookRoute />}
    </>
  );
};

export default LearningRoute;
