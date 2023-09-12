import * as React from "react";
import "animate.css";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import { CardHeader, Tooltip } from "@mui/material";
import TextField from "@mui/material/TextField/TextField";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Vocab } from "../../../logic/classes/vocab.class";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import SentimentVeryDissatisfiedIcon from "@mui/icons-material/SentimentVeryDissatisfied";
import { useAppDispatch } from "../../../app/hooks";
import { checkVoc } from "../../../app/slices/learning-slice";
import { updateVocabLS } from "../../../app/slices/vocabs-slice";
import { updateVocDb } from "../../../utils/firebase/firebase-vocab";
import { VocCheckingMode } from "../../../app/slices/settings-slice";
import { isTypo } from "../../../utils/general-scripts/isTypo";

const LearnCard = ({
  vocab,
  vocabs,
  index,
  last,
  uid,
  goNext,
  checkMode,
}: {
  vocab: Vocab;
  vocabs: Vocab[];
  index: number;
  last: number;
  uid: string;
  checkMode: VocCheckingMode;
  goNext: (val: number) => void;
}) => {
  const dispatch = useAppDispatch();
  const [checked, setChecked] = React.useState(false);
  const [result, setResult] = React.useState(false);
  const [answer, setAnswer] = React.useState("");
  const [hintsShown, setHintsShown] = React.useState(false);
  React.useEffect(() => {
    setChecked(vocab.getChecked());
    setResult(vocab.getResult());
    setAnswer(vocab.getLastAnswer());
  }, [vocab.getChecked(), vocab.getResult()]);

  let hints = vocab.getHints().join(", ");
  if (!hints || hints === "") hints = "No Hints added to this Vocab";

  const handleCeck = () => {
    if (answer === "") return;
    let result = vocab.getTranslArr().includes(answer.trim());
    if (checkMode === "normal") {
      const results: boolean[] = vocab
        .getTranslArr()
        .map((trans) => trans.toLowerCase() === answer.trim().toLowerCase());
      result = results.some((el) => el === true);
    }
    if (checkMode === "loose") {
      vocab.getTranslArr().forEach((trans) => {
        if (isTypo(answer.toLowerCase(), trans.toLowerCase(), 2)) result = true;
      });
    }
    const vocObj = vocab.getVocObj();
    dispatch(checkVoc({ id: vocab.getId(), result, answer, index }));
    dispatch(updateVocabLS(vocObj));
    vocab.addLearnHis(result).calcScore(result).calcImp(5);
    updateVocDb(vocObj, uid);
  };

  return (
    <Card
      className="learn-card"
      sx={{ minWidth: 275, flex: "1", py: 0, my: 0 }}
    >
      <CardHeader
        sx={{ textAlign: "center" }}
        title={vocab.getVocArr()[0]}
        subheader={vocab.getVocabSliceString()}
        action={
          <IconButton aria-label="settings">
            <MoreVertIcon />
          </IconButton>
        }
      />
      <Typography textAlign="center">
        {vocab.getPronuncStr() || "No Pronunctiation"}
      </Typography>
      {checked ? (
        <CardHeader
          className="animate__bounceIn"
          sx={
            vocab.getResult()
              ? { textAlign: "center ", color: "#4BB543" }
              : { textAlign: "center ", color: "#f14336" }
          }
          title={vocab.getTranslArr()[0]}
          color="#4BB543"
          subheader={vocab.getTranslSliceString()}
        />
      ) : (
        <CardHeader title="&nbsp;" subheader="&nbsp;" />
      )}

      <CardContent>
        <Button onClick={() => setHintsShown((cur) => !cur)}>Show Hints</Button>
        {hintsShown && (
          <Box>
            <Typography pt={1}>{hints}</Typography>
          </Box>
        )}
      </CardContent>
      <CardActions>
        <TextField
          // disabled={checked}
          color={checked ? (result ? "success" : "error") : undefined}
          variant="outlined"
          label={checked ? "checked" : "Enter 1 translation"}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (!checked) return handleCeck();
            if (index === last) return goNext(0);
            goNext(index + 1);
          }}
          onChange={(e) => {
            if (checked) return;
            setAnswer(e.currentTarget.value);
          }}
          fullWidth
          autoFocus
          value={answer}
        />
        {checked && (
          <>
            {!result ? (
              <>
                <SentimentVeryDissatisfiedIcon sx={{ mx: 1 }} color="error" />
                <Tooltip title="Mark answer as correct" arrow>
                  <IconButton size="small" sx={{ m: 0 }}>
                    <CheckIcon />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <SentimentSatisfiedAltIcon sx={{ mx: 1 }} color="success" />
            )}
            <Tooltip title="Edit this Vocab" arrow>
              <IconButton size="small" sx={{ m: 0 }}>
                <EditIcon sx={{ m: 0 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Button
          size="small"
          sx={{ m: 0 }}
          onClick={() => {
            if (!checked) return handleCeck();
            if (index === last) return goNext(0);
            goNext(index + 1);
          }}
        >
          {checked ? "go next" : "check"}
        </Button>
      </CardActions>
    </Card>
  );
};

export default LearnCard;
