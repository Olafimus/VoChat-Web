import { useEffect, useState, useRef, MouseEvent } from "react";
import "react-toastify/dist/ReactToastify.css";
import {
  Box,
  Divider,
  Button,
  IconButton,
  TextField,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import MultiSelect, { MySelectOptionType } from "../general/multi-select";
import { VocObj, WorkbookType } from "../../logic/types/vocab.types";
import { nanoid } from "@reduxjs/toolkit";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  addVocab,
  addVoctoAdded,
  updateSavedVoc,
  updateVocabLS,
} from "../../app/slices/vocabs-slice";
import { createArrFromString } from "../../utils/vocab-scripts/conver-string-to-array";
import ConfirmDialog from "../general/confirm-dialog";
import Dialog, { DialogProps } from "@mui/material/Dialog";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SwitchMenu from "../general/switchmenu";
import ImportanceSlider from "./Importance-slider";
import {
  supLangObj,
  supportedLanguages,
} from "../../utils/constants/supported-langs";
import {
  addVocToDb,
  updateAddedDataVocs,
  updateVocDb,
} from "../../utils/firebase/firebase-vocab";
import { dataLangIdSet } from "../../assets/constants/db-lang-obj";
import { addDataRef } from "../../app/slices/user-slice";
import { ToastContainer, toast } from "react-toastify";

let fullScreen = true;

const textFieldStyle = {
  width: "100%",
  padding: "0.4rem",
  maxHeigt: 50,
  overflow: "auto",
};

export type EditProps = {
  type?: "add" | "edit" | "wbAdd";
  open: boolean;
  setOpen: (val: boolean) => void;
  render?: boolean;
  setRender?: (val: boolean) => void;
  voc?: string;
  tra?: string;
  wbs?: MySelectOptionType[];
  cats?: MySelectOptionType[];
  pronunc?: string;
  hints?: string;
  imp?: number;
  vocId?: string;
  vocab?: Vocab;
  sendVoc: boolean;
};

const AddVocab = ({
  type = "add",
  open = false,
  setOpen,
  render,
  setRender,
  voc = "",
  tra = "",
  wbs = [],
  cats = [],
  pronunc = "",
  hints = "",
  imp = 8,
  vocId,
  vocab,
  sendVoc = false,
}: EditProps) => {
  const [scroll, setScroll] = useState<DialogProps["scroll"]>("paper");
  const vocFieldRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const [importance, setImportance] = useState(imp); // nachher als prop
  const [openConfirm, setOpenConfirm] = useState(false);
  // const [openSet, setOpenSet] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const handleClose = () => setOpen(false);
  const [wbOptions, setWbOptions] = useState<MySelectOptionType[]>([]);
  const [catOptions, setCatOptions] = useState<MySelectOptionType[]>([]);
  const [wbSelection, setWbSelection] = useState<MySelectOptionType[]>(wbs);
  const [catSelection, setCatSelection] = useState<MySelectOptionType[]>(cats);
  const [vocabErr, setVocabErr] = useState(false);
  const [translErr, setTranslErr] = useState(false);
  const [vocabTxt, setVocabTxt] = useState(voc);
  const [translTxt, setTranslTxt] = useState(tra);
  const [pronounceTxt, setPronounceTxt] = useState(pronunc);
  const [hintsTxt, setHintsTxt] = useState(hints);
  const [vocs, setVocs] = useState<AllVocabsClass>(new AllVocabsClass([]));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openSet = Boolean(anchorEl);
  const handleMenuClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const { currentLang, nativeLang, workbooks, categories } = useAppSelector(
    (state) => state.vocabs
  );
  const { id: uid } = useAppSelector((state) => state.user);
  const { allVocabs, dbLang } = useAppSelector((state) => state.allVocabs);
  const { vocabSubSettings } = useAppSelector((state) => state.settings);
  const [vocLang, setVocLang] = useState(currentLang);
  const [transLang, setTransLang] = useState(nativeLang);

  const failedSending = () =>
    toast.error("Failed to send vocab to DB", {
      position: "bottom-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });

  const handleVocLang = (event: SelectChangeEvent) => {
    // setVocLang("FA");
    setVocLang(event.target.value as string);
  };

  const handleTransLang = (event: SelectChangeEvent) => {
    setTransLang(event.target.value as string);
  };
  let [transLangDisabler, setTransLangDisabler] = useState(true);
  let [vocLangDisabler, setVocLangDisabler] = useState(true);
  let disable = true;
  if (vocabTxt !== "" && translTxt !== "") disable = false;
  // const dummyOptions = [
  //   { label: "Colors", value: "d#a24" },
  //   { label: "Animals", value: "s3a#4" },
  // ];

  useEffect(() => {
    const newWbOptions: MySelectOptionType[] = [];
    const newCatOptions: MySelectOptionType[] = [];
    workbooks.forEach((wb) =>
      newWbOptions.push({ label: wb.name, value: wb.id })
    );
    categories.forEach((cat) => newCatOptions.push({ label: cat, value: cat }));
    console.log("new wb: ", newWbOptions);
    setWbOptions(newWbOptions);
    setCatOptions(newCatOptions);
    if (vocab) {
      setTransLang(vocab.getTransLang());
      setVocLang(vocab.getVocLang());
    }
  }, [workbooks.length]);

  const defaultVal = importance;

  // useEffect(() => {
  //   setVocLang(currentLang);
  // }, []);

  const validationCheck = () => {
    if (vocabTxt === "") setVocabErr(true);
    if (translTxt === "") setTranslErr(true);
    if (vocabTxt === "" || translTxt === "") return;
  };

  const handleSubmit = () => {
    validationCheck();
    const workbooks: WorkbookType[] = [];
    const categories: string[] = catSelection.map((item) => item.label);

    wbSelection.forEach((sel) => {
      const timeStamp = Date.now();
      const newWb: WorkbookType = {
        owner: uid,
        name: sel.label,
        id: sel.value,
        vocLanguage: vocLang,
        transLanguage: transLang,
        score: 0,
        createdAt: timeStamp,
        createdBy: uid,
        lastLearned: 0,
        lastUpdated: timeStamp,
      };
      workbooks.push(newWb);
    });
    let id = nanoid();
    let dataId = vocab?.getId();
    if (vocId) id = vocId;

    const newVocObj: VocObj = {
      owner: uid,
      id,
      createdAt: Date.now(),
      vocLanguage: vocLang,
      transLanguage: nativeLang,
      vocab: createArrFromString(vocabTxt),
      translation: createArrFromString(translTxt),
      pronunciation: createArrFromString(pronounceTxt),
      categories,
      hints: createArrFromString(hintsTxt),
      workbooks,
      setImportance: importance,
      calcImportance: importance,
      learnHistory: [],
      score: 0,
      favored: false,
      favoredAt: 0,
      lastUpdated: 0,
      checkStatus: {
        checked: false,
        corrected: false,
        lastCorBy: null,
        lastCheckBy: null,
        lastChecked: 0,
      },
    };
    if (dataId) newVocObj.dataId = dataId;
    if (type === "add" || type === "wbAdd") {
      const newVoc = new Vocab(newVocObj);
      allVocabs.addVocab(newVoc);

      dispatch(addVocab(newVocObj));

      addVocToDb(newVocObj);

      if (vocab && dbLang && dataLangIdSet.includes(vocab.getOwner())) {
        vocab.updateAdded(true);
        dispatch(addVoctoAdded({ lang: dbLang, vocId: vocab.getId() }));
        dispatch(
          updateSavedVoc({ lang: dbLang, vocId: vocab.getId(), val: true })
        );
        try {
          const id = nanoid();
          updateAddedDataVocs(uid, dbLang, vocab.getId(), id);
          dispatch(addDataRef({ lang: dbLang, ref: id }));
        } catch (error) {
          console.log(error);
        }
      }
      setVocs(vocs);
      setVocabTxt("");
      setTranslTxt("");
      setPronounceTxt("");
      setHintsTxt("");
      if (type === "add" && !vocabSubSettings.keepWbs) setWbSelection([]);
      if (type === "add" && !vocabSubSettings.keepCats) setCatSelection([]);
      setVocLangDisabler(true);
      setTransLangDisabler(true);
      if (setRender) setRender(!render);
      if (vocabSubSettings.closeAfterAdd) {
        handleClose();
      } else vocFieldRef.current?.focus();
    }
    if (type === "edit" && vocab) {
      vocab.updateVoc(newVocObj);
      dispatch(updateVocabLS(vocab.getVocObj()));
      updateVocDb(vocab.getVocObj(), uid);
      if (vocabSubSettings.closeAfterEdit) handleClose();
    }
  };
  // console.log(dummyVocabs);

  useEffect(() => {
    if (!confirmed) return;
    handleSubmit();
    setConfirmed(false);
  }, [confirmed]);

  const descriptionElementRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) {
      const { current: descriptionElement } = descriptionElementRef;
      if (descriptionElement !== null) {
        descriptionElement.focus();
      }
    }
  }, [open]);

  return (
    <div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      ></ToastContainer>
      <Dialog
        open={open}
        onClose={handleClose}
        scroll={scroll}
        maxWidth="md"
        fullWidth={true}
        fullScreen={fullScreen}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
      >
        <DialogTitle
          display="flex"
          bgcolor="background.paper"
          id="scroll-dialog-title"
        >
          <span
            onClick={() => toast("so easy")}
            style={{ flex: "1", textAlign: "center" }}
          >
            Add Vocab
          </span>
          <IconButton
            aria-controls={openSet ? "demo-customized-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={openSet ? "true" : undefined}
            onClick={handleMenuClick}
          >
            <MoreVertIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          // bgcolor="background.paper"
          dividers={scroll === "paper"}
          sx={{ bgcolor: "background.paper" }}
        >
          <Box sx={{ minWidth: "200px" }}>
            <div
              className="add-vocabs-content-wrapper"
              style={{
                display: "flex",
                flexDirection: "column",

                gap: "0.2rem",
                justifyContent: "space-around",
              }}
            >
              <Box
                display={"flex"}
                alignItems={"center"}
                bgcolor={"transparent"}
              >
                <TextField
                  label={`Vocab in ${vocLang}`}
                  multiline
                  tabIndex={0}
                  maxRows={3}
                  autoFocus
                  ref={vocFieldRef}
                  variant="standard"
                  required
                  error={vocabErr}
                  value={vocabTxt}
                  onChange={(e) => {
                    setVocabErr(false);
                    setVocabTxt(e.currentTarget.value);
                  }}
                  style={textFieldStyle}
                />
                <Box sx={{ maxWidth: 200 }}>
                  <FormControl>
                    <InputLabel id="vocab-lang-picker-label">Lang</InputLabel>
                    <Select
                      labelId="vocab-lang-picker-label"
                      tabIndex={-1}
                      disabled={vocLangDisabler}
                      sx={{ minWidth: 60 }}
                      variant="standard"
                      id="voc-lang-selector"
                      value={vocLang}
                      label="Lang"
                      onClick={() => setVocLangDisabler(false)}
                      onChange={handleVocLang}
                    >
                      {supportedLanguages.map((lang) => (
                        <MenuItem key={lang[1]} value={lang[0]}>
                          <img
                            src={`https://flagcdn.com/16x12/${lang[1].toLowerCase()}.png`}
                            srcSet={`https://flagcdn.com/32x24/${lang[1].toLowerCase()}.png 2x, https://flagcdn.com/48x36/${
                              lang[1]
                            }.png 3x`}
                            width="16"
                            height="12"
                            style={{ marginRight: 10 }}
                            alt={`${lang[1]} Flag`}
                          ></img>
                          {lang[1]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              <Box display={"flex"} alignItems={"center"}>
                <TextField
                  label={`Translation in ${transLang}`}
                  variant="standard"
                  required
                  tabIndex={1}
                  multiline
                  maxRows={3}
                  error={translErr}
                  value={translTxt}
                  onChange={(e) => {
                    setTranslErr(false);
                    setTranslTxt(e.currentTarget.value);
                  }}
                  style={textFieldStyle}
                />
                <Box sx={{ maxWidth: 200 }}>
                  <FormControl>
                    <InputLabel id="demo-simple-select-label">Lang</InputLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      sx={{ minWidth: 60 }}
                      disabled={transLangDisabler}
                      onClick={() => setTransLangDisabler(false)}
                      variant="standard"
                      id="demo-simple-select"
                      value={transLang}
                      label="Translation language"
                      onChange={handleTransLang}
                      tabIndex={5}
                      // disabled
                    >
                      {supportedLanguages.map((lang) => (
                        <MenuItem key={lang[1]} value={lang[0]}>
                          <img
                            src={`https://flagcdn.com/16x12/${lang[1].toLowerCase()}.png`}
                            srcSet={`https://flagcdn.com/32x24/${lang[1].toLowerCase()}.png 2x, https://flagcdn.com/48x36/${
                              lang[1]
                            }.png 3x`}
                            width="16"
                            height="12"
                            style={{ marginRight: 10 }}
                            alt={`${lang[1]} Flag`}
                          ></img>
                          {lang[1]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              {vocabSubSettings.showPronunc && (
                <TextField
                  label="pronunciation"
                  variant="standard"
                  multiline
                  maxRows={3}
                  value={pronounceTxt}
                  onChange={(e) => {
                    // setPronounceErr(false);
                    setPronounceTxt(e.currentTarget.value);
                  }}
                  style={textFieldStyle}
                />
              )}
              <Divider sx={{ margin: "5px" }} />
              {vocabSubSettings.showWbs && (
                <>
                  <MultiSelect
                    options={wbOptions}
                    selection={wbSelection}
                    setFunc={setWbSelection}
                    placeholder="Select Workbooks"
                    type="workbooks"
                  />
                  <Divider sx={{ margin: "5px" }} />
                </>
              )}
              {vocabSubSettings.showCat && (
                <>
                  <MultiSelect
                    options={catOptions}
                    selection={catSelection}
                    setFunc={setCatSelection}
                    placeholder="Select Categories"
                    type="categories"
                  />
                  <Divider sx={{ margin: "5px" }} />
                </>
              )}
              {vocabSubSettings.showHints && (
                <TextField
                  label="Hints"
                  variant="standard"
                  multiline
                  maxRows={3}
                  value={hintsTxt}
                  onChange={(e) => {
                    // setHintsErr(false);
                    setHintsTxt(e.currentTarget.value);
                  }}
                  style={textFieldStyle}
                />
              )}

              {/* <span
            className="workbook-selection-wrapper"
            style={{ margin: "0.1rem" }}
          > */}

              {/* </span> */}

              {vocabSubSettings.showImp && (
                <ImportanceSlider
                  importance={importance}
                  setImportance={setImportance}
                />
              )}
            </div>
          </Box>
          {/* </DialogContentText> */}
        </DialogContent>
        <DialogActions
          sx={{ bgcolor: "background.paper", justifyContent: "space-around" }}
        >
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="contained"
            size="medium"
            disabled={disable || sendVoc}
            onClick={() => {
              if (!vocabSubSettings.needConfirmation) {
                handleSubmit();
                return;
              }
              type === "edit" ? setOpenConfirm(true) : handleSubmit();
            }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
      <SwitchMenu
        open={openSet}
        setAnchorEl={setAnchorEl}
        anchorEl={anchorEl}
      />
      {type === "edit" && vocabSubSettings.needConfirmation && (
        <ConfirmDialog
          setConfirmed={setConfirmed}
          open={openConfirm}
          setOpen={setOpenConfirm}
        />
      )}
    </div>
  );
};

export default AddVocab;
