import React, { useState, useEffect } from "react";
import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { Vocab } from "../../logic/classes/vocab.class";
import LearnTabs from "../../components/vocabs/learning/learning-tabbar";
import SearchField from "../../components/general/search-field";
import { WorkbookType } from "../../logic/types/vocab.types";

const LearningRoute = () => {
  const { route } = useParams();
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { vocabLearnSettings } = useAppSelector((state) => state.settings);
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const [learnVocs, setLearnVocs] = useState<Vocab[]>([]);
  const [workbook, setWorkbook] = useState<null | string>(null);

  useEffect(() => {
    if (route === "default")
      setLearnVocs(
        allVocabs.getDefaultVocs(vocabLearnSettings.defaultVocCount)
      );
    if (route === "workbook" && workbook)
      setLearnVocs(allVocabs.getWbVocs(workbook));
  }, [route, workbook]);

  const DefaultRoute = () => {
    return (
      <Box display={"flex"} justifyContent="center">
        <LearnTabs vocabs={learnVocs}></LearnTabs>
      </Box>
    );
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
            <LearnTabs vocabs={learnVocs}></LearnTabs>
          </Box>
        )}
      </>
    );
  };
  console.log(route);
  return (
    <>
      <Typography>2 / 4</Typography>
      {route === "default" && <DefaultRoute />}
      {route === "workbook" && <WorkbookRoute />}
    </>
  );
};

export default LearningRoute;
