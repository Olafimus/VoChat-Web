import { useState, useEffect } from "react";
import { Box, TextField } from "@mui/material";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepButton from "@mui/material/StepButton";
import CredentialsStep from "./credential-step";
import LanguageConfiguration, {
  LangProp,
} from "../../../components/general/screen-elements/language-configuration";
import StartJourney from "./start-journey";
import { useAppDispatch } from "../../../app/hooks";
import {
  createAuthUserWithEmailAndPassword,
  createUserDocumentFromAuth,
} from "../../../utils/firebase";
import { resetUserState, setCurrentUser } from "../../../app/slices/user-slice";
import { resetConversations } from "../../../app/slices/conversation-slice";

type Credentials = {
  name: string;
  mail: string;
  password: string;
};

const steps = ["Create Account", "Choose Languages"];

export default function SignUpStepper() {
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<{
    [k: number]: boolean;
  }>({});
  const dispatch = useAppDispatch();
  const [credentials, setCredentials] = useState<null | Credentials>(null);
  const [langs, setLangs] = useState<LangProp>({
    vocLang: "",
    transLang: "",
    learnLangs: [],
    teachLangs: [],
  });

  useEffect(() => {
    dispatch(resetUserState());
    dispatch(resetConversations());
    console.log("run");
  }, []);

  const totalSteps = () => {
    return steps.length;
  };

  const completedSteps = () => {
    return Object.keys(completed).length;
  };

  const isLastStep = () => {
    return activeStep === totalSteps() - 1;
  };

  const allStepsCompleted = () => {
    return completedSteps() === totalSteps();
  };

  const handleNext = () => {
    const newActiveStep =
      isLastStep() && !allStepsCompleted()
        ? // It's the last step, but not all steps have been completed,
          // find the first step that has been completed
          steps.findIndex((step, i) => !(i in completed))
        : activeStep + 1;
    setActiveStep(newActiveStep);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleStep = (step: number) => () => {
    setActiveStep(step);
  };

  const handleComplete = () => {
    const newCompleted = completed;
    newCompleted[activeStep] = true;
    setCompleted(newCompleted);
    handleNext();
  };

  const handleFinish = async () => {
    if (!credentials) return;
    try {
      const user = await createAuthUserWithEmailAndPassword(
        credentials.mail,
        credentials.password
      );
      if (!user) throw new Error("fail");
      const teachLangs = langs.teachLangs.map((el) => el[0]);
      const learnLangs = langs.learnLangs.map((el) => el[0]);
      await createUserDocumentFromAuth(
        user.user,
        credentials.name,
        langs.vocLang,
        langs.transLang,
        teachLangs,
        learnLangs
      );
      dispatch(setCurrentUser(user.user));
      handleComplete();
      allStepsCompleted();
    } catch (err) {
      console.log(err);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setCompleted({});
  };

  const handleCredSub = (creds: Credentials) => {
    setCredentials(creds);
    handleComplete();
    handleNext();
  };

  const StepOne = () => (
    <CredentialsStep credentials={credentials} handleCredSub={handleCredSub} />
  );
  const StepTwo = () => (
    <Box my={3} display="flex" justifyContent="center">
      <LanguageConfiguration
        type="setUp"
        goBack={handleBack}
        langs={langs}
        setLangs={setLangs}
        finish={handleFinish}
      />
    </Box>
  );
  const StepThree = () => <StartJourney />;

  return (
    <Box
      id="123"
      minHeight="80dvh"
      mt={5}
      sx={{ width: "100%", height: "100%" }}
    >
      <Stepper nonLinear activeStep={activeStep}>
        {steps.map((label, index) => (
          <Step key={label} completed={completed[index]}>
            <StepButton color="inherit" onClick={handleStep(index)}>
              {label}
            </StepButton>
          </Step>
        ))}
      </Stepper>
      <Box mt={5}>
        {allStepsCompleted() ? (
          <StartJourney />
        ) : (
          <>
            {activeStep === 0 && <StepOne />}
            {activeStep === 1 && <StepTwo />}
          </>
        )}
      </Box>
    </Box>
  );
}
