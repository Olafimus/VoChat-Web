import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import LearnTabs from "../../components/vocabs/learning/learning-tabbar";
import {
  setCurLearnVocabs,
  setLearnStart,
  setLearnVocabs,
  setRoute,
} from "../../app/slices/learning-slice";
import WorkbookRoute from "./workbook-route";
import { Vocab } from "../../logic/classes/vocab.class";

export type LearnRoutes = "default" | "workbook" | "random" | "mistakes" | null;

const LearningRoute = () => {
  const { route } = useParams();
  const dispatch = useAppDispatch();
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { vocabLearnSettings } = useAppSelector((state) => state.settings);
  const navigate = useNavigate();
  // const { started } = useAppSelector((state) => state.learning);
  // const [learnVocs, setLearnVocs] = useState<Vocab[]>([]);

  useEffect(() => {
    // if (started) return;
    if (allVocabs.getVocCount() === 0) return navigate("/vocab/learning");
    let vocs: Vocab[] = [];
    if (route === "default") {
      // setLearnVocs(
      //   allVocabs.getDefaultVocs(vocabLearnSettings.defaultVocCount, 5)
      // );
      vocs = allVocabs.getDefaultVocs(
        vocabLearnSettings.defaultVocCount,
        vocabLearnSettings.vocabTimeOut,
        vocabLearnSettings.rethrowMistakes
      );

      dispatch(setRoute("default"));
    }

    if (route === "random") {
      vocs = allVocabs.getRndVocs(vocabLearnSettings.defaultVocCount);
      dispatch(setRoute("random"));
    }

    if (route === "mistakes") {
      vocs = allVocabs.getLastMistakes(vocabLearnSettings.defaultVocCount);
      dispatch(setRoute("mistakes"));
    }

    dispatch(setLearnVocabs(vocs));
    dispatch(setCurLearnVocabs({ vocs, withStarted: false }));
    dispatch(setLearnStart(true));
    // dispatch(setLearnStart(true));
  }, []);

  const DefaultRoute = () => {
    return (
      <Box display={"flex"} justifyContent="center">
        <LearnTabs />
      </Box>
    );
  };

  return (
    <>
      {route === "default" && <DefaultRoute />}
      {route === "random" && <DefaultRoute />}
      {route === "mistakes" && <DefaultRoute />}
      {route === "workbook" && <WorkbookRoute />}
    </>
  );
};

export default LearningRoute;
