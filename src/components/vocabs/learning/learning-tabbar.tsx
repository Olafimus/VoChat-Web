import Tabs from "@mui/material/Tabs";
import React, { useState, useEffect } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Tab, Box, Typography, Button } from "@mui/material";
import { Vocab } from "../../../logic/classes/vocab.class";
import TabPanel from "../../general/tab-bar/tab-panel";
import LearnCard from "./learning-card";
import { Link } from "react-router-dom";
import { grey } from "@mui/material/colors";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { updateVocabLS } from "../../../app/slices/vocabs-slice";
import { updateVocDb } from "../../../utils/firebase/firebase-vocab";

function a11yProps(index: number) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}

export default function LearnTabs({ vocabs }: { vocabs: Vocab[] }) {
  const [value, setValue] = useState(0);
  const [finished, setFinished] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [filteredVocabs, setFilteredVocabs] = useState<Vocab[]>([]);
  const dispatch = useAppDispatch();
  const { id: uid } = useAppSelector((state) => state.user);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const goToNext = (val: number) => {
    setValue(val);
  };

  const startAgain = () => {
    vocabs.forEach((voc) => voc.resetStatus());
    setFilteredVocabs(vocabs);
    setCompleted(false);
    setFinished(false);
  };

  const retryMistakes = () => {
    const newVocArr: Vocab[] = [];
    vocabs.forEach((voc) => {
      if (voc.getResult() === false) newVocArr.push(voc);
    });
    if (newVocArr.length === 0) {
      vocabs.forEach((voc) => voc.resetStatus());
      setCompleted(true);
    }
    newVocArr.forEach((voc) => voc.resetStatus());
    setFilteredVocabs(newVocArr);
    setFinished(false);
  };

  useEffect(() => {
    setFilteredVocabs(vocabs);
  }, [vocabs.length]);

  useEffect(() => {
    if (!finished) return;
    const newVocArr: Vocab[] = [];
    filteredVocabs.forEach((voc) => {
      const result = voc.getResult();
      voc.addLearnHis(result).calcScore(result).calcImp(5);
      const vocObj = voc.getVocObj();
      dispatch(updateVocabLS(vocObj));
      updateVocDb(vocObj, uid);
    });
    vocabs.forEach((voc) => {
      if (voc.getResult() === false) newVocArr.push(voc);
    });
    if (newVocArr.length === 0) {
      vocabs.forEach((voc) => voc.resetStatus());
      setCompleted(true);
    }
  }, [finished]);

  useEffect(() => {
    // console.log(vocabs);
  }, [completed]);

  return (
    <Box
      id="test"
      sx={{
        flexGrow: 1,
        bgcolor: "background.paper",
        display: "flex",
        height: 450,
      }}
    >
      {completed ? (
        <Box flex={1}>
          <Typography flex={1} variant="h5">
            Congrats
          </Typography>
          <Typography flex={1} variant="h6">
            Congrats you answered every vocab correctly!
          </Typography>
          <Box display={"flex"} flexDirection={"column"}>
            <Link to="/vocab/learning">
              <Button>Choose a new Method</Button>
            </Link>
            <Link to="/vocab/learning/default">
              <Button>Next Default Method</Button>
            </Link>
            <Button onClick={startAgain}>Again with the same vocabs</Button>
          </Box>
        </Box>
      ) : (
        <>
          <Tabs
            orientation="vertical"
            variant="scrollable"
            value={value}
            onChange={handleChange}
            aria-label="Vertical tabs example"
            sx={{ borderRight: 1, borderColor: "divider" }}
          >
            {" "}
            {filteredVocabs.map((voc, i) => (
              <Tab
                key={voc.getId()}
                label={voc.getVocArr()[0]}
                {...a11yProps(0)}
              /> // je 1 style für korrekt und falsch
            ))}
          </Tabs>
          <Box id="inner-box" flex={1}>
            {filteredVocabs.map((vocab, i) => (
              <TabPanel
                key={vocab.getId()}
                goNext={goToNext}
                value={value}
                index={i}
              >
                <LearnCard
                  vocab={vocab}
                  vocabs={filteredVocabs}
                  goNext={goToNext}
                  index={i}
                  last={vocabs.length - 1}
                  setFinished={setFinished}
                />
              </TabPanel>
            ))}
            {finished && (
              <Box>
                <Typography>You answered every Vocab!</Typography>

                <Button sx={{ color: grey[500], m: 1 }}>
                  Back to Route Selection
                </Button>
                <Button
                  sx={{ m: 1 }}
                  variant="contained"
                  onClick={retryMistakes}
                >
                  Restart with Mistakes
                </Button>
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
