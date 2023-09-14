import Tabs from "@mui/material/Tabs";
import React, { useState, useEffect } from "react";
import { Tab, Box, Typography, Button } from "@mui/material";
import { Vocab } from "../../../logic/classes/vocab.class";
import TabPanel from "../../general/tab-bar/tab-panel";
import LearnCard from "./learning-card";
import { Link } from "react-router-dom";
import { grey } from "@mui/material/colors";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { updateVocabLS } from "../../../app/slices/vocabs-slice";
import { updateVocDb } from "../../../utils/firebase/firebase-vocab";
import LearnHeader from "./learning-header";
import {
  resetLearnSlice,
  setCompleted,
  setCurLearnVocabs,
  setRoundFinished,
} from "../../../app/slices/learning-slice";
import { useVocFunctions } from "../../../utils/hooks/useVocFunctions";
import { globalColors } from "../../../assets/constants/colors";

function a11yProps(index: number) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}

export default function LearnTabs() {
  const { currentIndex, roundFinished, completed, currentVocabs, vocabs } =
    useAppSelector((s) => s.learning);
  const [value, setValue] = useState(currentIndex);
  const dispatch = useAppDispatch();
  const { theme, vocabLearnSettings } = useAppSelector(
    (state) => state.settings
  );
  const { id: uid } = useAppSelector((state) => state.user);
  const { startAgain, retryMistakes, updateVocabs, startNewDefault } =
    useVocFunctions(setValue);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const goToNext = (val: number) => {
    setValue(val);
  };

  // const startAgain = () => {
  //   vocabs.forEach((voc) => voc.resetStatus());
  //   dispatch(setCurLearnVocabs(vocabs));
  //   dispatch(setCompleted(false));
  //   dispatch(setRoundFinished(false));
  //   // setFilteredVocabs(vocabs);
  //   // setCompleted(false);
  //   // setFinished(false);
  // };

  // const retryMistakes = () => {
  //   const newVocArr: Vocab[] = [];
  //   vocabs.forEach((voc) => {
  //     if (voc.getResult() === false) newVocArr.push(voc);
  //   });
  //   if (newVocArr.length === 0) {
  //     vocabs.forEach((voc) => voc.resetStatus());
  //     dispatch(setCompleted(true));
  //   }
  //   newVocArr.forEach((voc) => voc.resetStatus());
  //   dispatch(setCurLearnVocabs(newVocArr));
  //   dispatch(setRoundFinished(false));
  //   // setFilteredVocabs(newVocArr);
  //   // setFinished(false);
  // };

  // useEffect(() => {
  //   setFilteredVocabs(vocabs);
  // }, [vocabs.length]);

  // const updateVocabs = () => {
  //   currentVocabs.forEach((voc) => {
  //     const result = voc.getResult();
  //     voc.addLearnHis(result).calcScore(result).calcImp(5);
  //     const vocObj = voc.getVocObj();
  //     dispatch(updateVocabLS(vocObj));
  //     updateVocDb(vocObj, uid);
  //   });
  // };

  // const getNewRoundVocs = () => {
  //   const newVocArr: Vocab[] = [];
  //   currentVocabs.forEach((voc) => {
  //     if (voc.getResult() === false) newVocArr.push(voc);
  //   });
  //   if (newVocArr.length === 0) {
  //     vocabs.forEach((voc) => voc.resetStatus());
  //     setCompleted(true);
  //   }
  // };

  // useEffect(() => {
  //   if (!finished) return;

  //   const newVocArr: Vocab[] = [];
  //   filteredVocabs.forEach((voc) => {
  //     const result = voc.getResult();
  //     voc.addLearnHis(result).calcScore(result).calcImp(5);
  //     const vocObj = voc.getVocObj();
  //     // dispatch(updateVocabLS(vocObj));
  //     updateVocDb(vocObj, uid);
  //   });
  //   filteredVocabs.forEach((voc) => {
  //     if (voc.getResult() === false) newVocArr.push(voc);
  //   });
  //   if (newVocArr.length === 0) {
  //     vocabs.forEach((voc) => voc.resetStatus());
  //     setCompleted(true);
  //   }
  //   console.log("reached here");
  // }, [finished]);

  // // useEffect(() => {
  // //   // console.log(vocabs);
  // // }, [completed]);
  // console.log(finished);

  return (
    <>
      <LearnHeader theme={theme} />
      <Box
        id="test"
        mt="4em"
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
              <Link
                to="/vocab/learning"
                onClick={() => dispatch(resetLearnSlice())}
              >
                <Button>Choose a new Method</Button>
              </Link>
              <Link to="/vocab/learning/default" onClick={startNewDefault}>
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
              {currentVocabs.map((voc, i) => (
                <Tab
                  key={voc.getId()}
                  label={voc.getVocArr()[0]}
                  {...a11yProps(0)}
                  sx={
                    voc.getChecked()
                      ? voc.getResult()
                        ? { color: globalColors.successGreen }
                        : { color: globalColors.errorRed }
                      : {}
                  }
                /> // je 1 style für korrekt und falsch
              ))}
            </Tabs>
            <Box id="inner-box" flex={1}>
              {currentVocabs.map((vocab, i) => (
                <TabPanel
                  key={vocab.getId()}
                  goNext={goToNext}
                  value={value}
                  index={i}
                >
                  <LearnCard
                    vocab={vocab}
                    vocabs={currentVocabs}
                    goNext={goToNext}
                    index={i}
                    last={vocabs.length - 1}
                    uid={uid}
                    checkMode={vocabLearnSettings.checkingConditions}
                  />
                </TabPanel>
              ))}

              {roundFinished && (
                <Box>
                  <Typography>You answered every Vocab!</Typography>
                  <Link
                    to="/vocab/learning/"
                    onClick={() => dispatch(resetLearnSlice())}
                  >
                    <Button sx={{ color: grey[500], m: 1 }}>
                      Back to Route Selection
                    </Button>
                  </Link>
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
    </>
  );
}
