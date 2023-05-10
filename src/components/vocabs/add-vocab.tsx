import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Modal from "@mui/material/Modal";
import TextField from "@mui/material/TextField";
import Slider from "@mui/material/Slider";
import MultiSelect, { MySelectOptionType } from "../general/multi-select";
import { VocObj } from "../../logic/types/vocab.types";
import { nanoid } from "@reduxjs/toolkit";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";
import { useAppDispatch } from "../../app/hooks";
import { addVocab } from "../../app/slices/vocabs-slice";

const style = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "80vw",
  bgcolor: "background.paper",
  border: "2px solid #000",
  height: "90vh",
  overflow: "auto",
  boxShadow: 24,
  p: 4,
};

const textFieldStyle = {
  width: "100%",
  padding: "0.4rem",
};

const AddVocab = () => {
  const [open, setOpen] = React.useState(false);
  const dispatch = useAppDispatch();
  const [importance, setImportance] = React.useState(8); // nachher als prop
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [selection, setSelection] = React.useState<MySelectOptionType[]>([]);
  const [vocabErr, setVocabErr] = React.useState(false);
  const [translErr, setTranslErr] = React.useState(false);
  // const [pronounceErr, setPronounceErr] = React.useState(false);
  const [vocabTxt, setVocabTxt] = React.useState("");
  const [translTxt, setTranslTxt] = React.useState("");
  const [pronounceTxt, setPronounceTxt] = React.useState("");
  const [hintsTxt, setHintsTxt] = React.useState("");
  const [vocs, setVocs] = React.useState<AllVocabsClass>(
    new AllVocabsClass([])
  );
  let disable = true;
  if (vocabTxt !== "" && translTxt !== "") disable = false;
  const dummyOptions = [
    { label: "Colors", value: "d#a24" },
    { label: "Animals", value: "s3a#4" },
    { label: "Animass", value: "s3was4" },
    { label: "Animdfa", value: "s3was4" },
    { label: "Aniasds", value: "s3was4" },
    { label: "Aniasd", value: "s3was4" },
    { label: "Anass", value: "s3was4" },
    { label: "Animfa", value: "s3was4" },
    { label: "rdswas", value: "s3was4" },
  ];
  // const dummyVocabs = new AllVocabsClass([]);

  const colors = ["green", "lightgreen", "yellow", "orange", "red"];
  let color = colors[0];

  const setColor = () => {
    if (importance > 8) color = colors[0];
    if (importance > 6 && importance < 9) color = colors[1];
    if (importance > 4 && importance < 7) color = colors[2];
    if (importance > 2 && importance < 5) color = colors[3];
    if (importance < 3) color = colors[4];
  };
  setColor();

  const handleSubmit = () => {
    if (vocabTxt === "") setVocabErr(true);
    if (translTxt === "") setTranslErr(true);
    if (vocabTxt === "" || translTxt === "") return;
    console.log("passed");
    const workbooks: { name: string; id: string }[] = [];
    selection.forEach((sel) =>
      workbooks.push({ name: sel.label, id: sel.label })
    );
    const vocArr = vocabTxt.split(", ");
    const newVocObj: VocObj = {
      id: nanoid(),
      language: "farsi",
      vocab: vocArr,
      translation: [translTxt],
      pronounciation: [pronounceTxt],
      categorys: [],
      workbooks,
      setImportance: importance,
      calcImp: null,
      learnHistory: [],
      score: 0,
    };

    const newVoc = new Vocab(newVocObj);
    console.log();
    vocs.addVocab(newVoc);
    dispatch(addVocab(newVoc));
    setVocs(vocs);
    setVocabTxt("");
    setTranslTxt("");
    setPronounceTxt("");
    setHintsTxt("");
  };
  // console.log(dummyVocabs);
  const marks = [
    {
      value: 0,
      label: "0",
    },
    {
      value: 2,
      label: "2",
    },
    {
      value: 4,
      label: "4",
    },
    {
      value: 6,
      label: "6",
    },
    {
      value: 8,
      label: "8",
    },
    {
      value: 10,
      label: "10",
    },
  ];

  function valuetext(value: number) {
    return `${value}`;
  }
  console.log(vocs.getAllLangVocs("farsi"));
  return (
    <div>
      <Button onClick={handleOpen}>Add Vocab</Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <div
            className="add-vocab-modal-header-wrapper"
            style={{ display: "flex" }}
          >
            <Typography
              id="modal-modal-title"
              variant="h6"
              component="h2"
              sx={{ textAlign: "center", flex: 1 }}
            >
              Add a Vocab
            </Typography>
            <Button variant="outlined" onClick={handleClose}>
              X
            </Button>
          </div>
          <div
            className="add-vocabs-content-wrapper"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "92%",
              gap: "0.2rem",
              justifyContent: "space-around",
            }}
          >
            <TextField
              label="Vocab"
              variant="outlined"
              required
              error={vocabErr}
              value={vocabTxt}
              onChange={(e) => {
                setVocabErr(false);
                setVocabTxt(e.currentTarget.value);
              }}
              style={textFieldStyle}
            />
            <TextField
              label="Translation"
              variant="outlined"
              required
              error={translErr}
              value={translTxt}
              onChange={(e) => {
                setTranslErr(false);
                setTranslTxt(e.currentTarget.value);
              }}
              style={textFieldStyle}
            />
            <TextField
              label="Pronounciation"
              variant="outlined"
              value={pronounceTxt}
              onChange={(e) => {
                // setPronounceErr(false);
                setPronounceTxt(e.currentTarget.value);
              }}
              style={textFieldStyle}
            />
            <MultiSelect
              options={dummyOptions}
              selection={selection}
              setFunc={setSelection}
              placeholder="Select Workbooks"
            />
            <TextField
              label="Hints"
              variant="standard"
              value={hintsTxt}
              onChange={(e) => {
                // setHintsErr(false);
                setHintsTxt(e.currentTarget.value);
              }}
              style={textFieldStyle}
            />
            <span></span>
            {/* <span
            className="workbook-selection-wrapper"
            style={{ margin: "0.1rem" }}
          > */}

            {/* </span> */}

            <Box sx={{ width: "100%" }}>
              <span
                className="importance-title wrapper"
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <Typography>low</Typography>
                <Typography> --- </Typography>
                <Typography>Importance</Typography>
                <Typography>--- </Typography>
                <Typography>high</Typography>
              </span>
              <Slider
                aria-label="Custom marks"
                defaultValue={importance}
                // value={importance}
                onChange={(_, value) => {
                  if (typeof value === "number") setImportance(value);
                }}
                getAriaValueText={valuetext}
                step={1}
                valueLabelDisplay="auto"
                marks={marks}
                max={10}
                sx={{ color }}
                // orientation="vertical"
              />
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                marginTop: "0.2rem",
              }}
            >
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={disable}
              >
                Submit
              </Button>
            </Box>
          </div>
        </Box>
      </Modal>
    </div>
  );
};

export default AddVocab;
