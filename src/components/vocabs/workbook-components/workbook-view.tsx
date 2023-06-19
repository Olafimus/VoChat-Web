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
import { useAppSelector } from "../../../app/hooks";
import { getSharedWb } from "../../../utils/firebase";

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
            <Tooltip title="delete and add vocabs from this workbook">
              <Button>Manage</Button>
            </Tooltip>
            <Tooltip title="Add this workbook to your workbooks">
              <Button>Add to your Books</Button>
            </Tooltip>
          </span>
        ) : (
          <span>
            <Tooltip title="Edit this workbook">
              <IconButton size="small">Edit</IconButton>
            </Tooltip>
            <Tooltip title="Learn this workbook">
              <IconButton size="small">Learn</IconButton>
            </Tooltip>
          </span>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default WorkbookView;
