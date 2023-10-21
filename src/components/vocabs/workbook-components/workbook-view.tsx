import React, { useEffect } from "react";
import {
  Grid,
  Box,
  IconButton,
  Typography,
  Tooltip,
  DialogTitle,
  DialogActions,
  DialogContent,
  Button,
  List,
  Divider,
} from "@mui/material";
import Dialog, { DialogProps } from "@mui/material/Dialog";
import { VocObj, WorkbookType } from "./../../../logic/types/vocab.types";
import { Vocab } from "./../../../logic/classes/vocab.class";
import ListItemText from "@mui/material/ListItemText/ListItemText";
import VocabListView from "./vocab-view";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { getSharedWb } from "../../../utils/firebase";
import { useNavigate } from "react-router-dom";
import { addVocab, addWorkbook } from "../../../app/slices/vocabs-slice";
import { addVocToDb } from "../../../utils/firebase/firebase-vocab";
import { addWbToDb } from "../../../utils/firebase/firebase-workbooks";

const WorkbookView = ({
  wb,
  wbVocRef,
  open,
  setOpen,
}: {
  wb: WorkbookType;
  wbVocRef: string;
  open: boolean;
  setOpen: (val: boolean) => void;
}) => {
  const [scroll, setScroll] = React.useState<DialogProps["scroll"]>("paper");
  const [vocabs, setVocabs] = React.useState<Vocab[]>([]);
  const nav = useNavigate();
  const dispatch = useAppDispatch();
  let fullScreen = false;

  let disableEdit = true;
  let type: "own" | "send" = "own";
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { id: uid } = useAppSelector((state) => state.user);

  const handleClose = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const loadWbVocs = async (ref: string) => {
      const wbVocs: VocObj[] = await getSharedWb(ref);
      const newVocs: Vocab[] = [];
      wbVocs.forEach((voc) => newVocs.push(new Vocab(voc)));
      setVocabs(newVocs);
      type = "send";
    };
    loadWbVocs(wbVocRef);
  }, [open]);

  return (
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
        bgcolor="background.paper"
        id="scroll-dialog-title"
        sx={{ textAlign: "center" }}
      >
        {wb.name}
      </DialogTitle>
      <DialogContent
        // bgcolor="background.paper"
        dividers={scroll === "paper"}
        sx={{ bgcolor: "background.paper" }}
      >
        <Grid container columns={2} spacing={2} mb={2}>
          <Grid item xs={1}>
            <Grid container columns={2}>
              <Grid item xs={1}>
                <Typography>Vocab Count</Typography>
              </Grid>
              <Grid item xs={1}>
                <Typography>{vocabs.length}</Typography>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={1}>
            <Grid container columns={2}>
              <Grid item xs={1}>
                <Typography>Created at</Typography>
              </Grid>
              <Grid item xs={1}>
                <Typography>{new Date(wb.createdAt).toDateString()}</Typography>
              </Grid>
            </Grid>
          </Grid>
          <Divider />
          <Grid item xs={1}>
            <Grid container columns={2}>
              <Grid item xs={1}>
                <Typography>last learned</Typography>
              </Grid>
              <Grid item xs={1}>
                <Typography>
                  {wb.lastLearned !== 0
                    ? new Date(wb.lastLearned).toDateString()
                    : "never"}
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          <Divider />
          <Grid item xs={1}>
            <Grid container columns={2}>
              <Grid item xs={1}>
                <Typography>Score</Typography>
              </Grid>
              <Grid item xs={1}>
                <Typography>{wb.score}</Typography>
              </Grid>
            </Grid>
          </Grid>
          <Divider />
          <Grid item xs={1}>
            <Grid container columns={2}>
              <Grid item xs={1}>
                <Typography>Created By</Typography>
              </Grid>
              <Grid item xs={1}>
                <Typography>{wb.createdBy}</Typography>
              </Grid>
            </Grid>
          </Grid>
          <Divider />
          <Grid item xs={1}>
            <Grid container columns={2}>
              <Grid item xs={1}>
                <Typography>Language</Typography>
              </Grid>
              <Grid item xs={1}>
                <Typography>{wb.vocLanguage}</Typography>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        <Divider />
        <List>
          <ListItemText
            primary="Vocabs"
            sx={{ textAlign: "center" }}
          ></ListItemText>
          {vocabs.map((vocab) => (
            <VocabListView key={vocab.getId()} vocab={vocab} type={type} />
          ))}
        </List>
      </DialogContent>
      <DialogActions
        sx={{ bgcolor: "background.paper", justifyContent: "space-around" }}
      >
        <Button onClick={handleClose}>Back</Button>

        {wb.createdBy !== uid ? (
          <span>
            {/* <Tooltip title="delete and add vocabs from this workbook">
              <Button>Manage</Button>
            </Tooltip> */}
            <Tooltip title="Add this workbook to your workbooks">
              <Button
                onClick={() => {
                  if (vocabs.length === 0)
                    alert(
                      "No Vocabs in this workbook. It either failed to load or no vocabs were provided"
                    );
                  const newWb: WorkbookType = { ...wb };
                  newWb.owner = uid;

                  const saveVoc = async (voc: Vocab) => {
                    const VocObj = voc.getVocObj();
                    VocObj.owner = uid;

                    dispatch(addVocab(VocObj));
                    await addVocToDb(VocObj);
                    allVocabs.addVocab(new Vocab(VocObj));
                  };
                  vocabs.forEach((voc) => saveVoc(voc));
                  const addWb = async () => {
                    dispatch(addWorkbook(newWb));
                    await addWbToDb(newWb);
                    nav("/vocab/workbooks");
                  };
                  addWb();
                }}
              >
                Add to your Books
              </Button>
            </Tooltip>
          </span>
        ) : (
          <Box display="flex" flexDirection="row" gap={2}>
            <Tooltip title="Edit this workbook">
              <Button
                variant="outlined"
                size="small"
                onClick={() => nav(`/vocab/workbooks/${wb.id}`)}
              >
                Edit
              </Button>
            </Tooltip>
            <Tooltip title="Learn this workbook">
              <Button
                variant="outlined"
                size="small"
                onClick={() => nav(`/vocab/learning/workbook/${wb.id}`)}
              >
                Learn
              </Button>
            </Tooltip>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default WorkbookView;
