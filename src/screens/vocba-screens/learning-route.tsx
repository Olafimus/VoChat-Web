import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useParams } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { Vocab } from "../../logic/classes/vocab.class";
import LearnTabs from "../../components/vocabs/learning/learning-tabbar";

const LearningRoute = () => {
  const { route } = useParams();
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const [learnVocs, setLearnVocs] = useState<Vocab[]>([]);

  useEffect(() => {
    if (route === "default") setLearnVocs(allVocabs.getDefaultVocs(20));
  }, [route]);
  console.log("learn rout vocs: ", learnVocs);
  return (
    <Box display={"flex"} justifyContent="center">
      <LearnTabs vocabs={learnVocs}></LearnTabs>
    </Box>
  );
};

export default LearningRoute;
