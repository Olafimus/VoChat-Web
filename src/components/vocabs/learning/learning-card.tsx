import * as React from "react";
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

const LearnCard = ({
  vocab,
  vocabs,
  index,
  last,
  goNext,
  setFinished,
}: {
  vocab: Vocab;
  vocabs: Vocab[];
  index: number;
  last: number;
  goNext: (val: number) => void;
  setFinished: (val: boolean) => void;
}) => {
  const [checked, setChecked] = React.useState(false);
  const [result, setResult] = React.useState(false);
  const [answer, setAnswer] = React.useState("");
  const [hintsShown, setHintsShown] = React.useState(false);

  let hints = vocab.getHints().join(", ");
  if (!hints || hints === "") hints = "No Hints added to this Vocab";

  const checkAnswer = () => {
    if (vocab.getTranslArr().includes(answer.trim())) {
      vocab.setResult(true);
    } else vocab.setResult(false);
  };

  const handleCeck = () => {
    if (answer === "") return;
    vocab.setChecked(true);
    setChecked(true);
    vocab.setlastAnswer(answer);

    checkAnswer();
    let check = true;
    vocabs.forEach((voc) => {
      if (!voc.getChecked()) check = false;
    });
    if (check) {
      setFinished(true);
      goNext(0);
    }
  };

  React.useEffect(() => {
    setChecked(vocab.getChecked());
    setResult(vocab.getResult());
    setAnswer(vocab.getLastAnswer());
  }, [vocab.getChecked(), vocab.getResult()]);

  return (
    <Card sx={{ minWidth: 275, flex: "1" }}>
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
      <Typography textAlign="center">pron 1 pron 2 </Typography>
      {checked ? (
        <CardHeader
          sx={{ textAlign: "center " }}
          title={vocab.getTranslArr()[0]}
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
            <Tooltip title="Mark answer as correct" arrow>
              <IconButton size="small" sx={{ m: 0 }}>
                <CheckIcon />
              </IconButton>
            </Tooltip>
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
