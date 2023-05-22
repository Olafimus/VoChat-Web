import * as React from "react";
import { Button, Grid, TextField, Typography } from "@mui/material";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Dialog from "@mui/material/Dialog";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import VirtualizedList from "../../general/virtualized-list";
import { Vocab } from "../../../logic/classes/vocab.class";
import { workbookType } from "../../../logic/types/vocab.types";
import { nanoid } from "@reduxjs/toolkit";
import { addWorkbook, updateVocabLS } from "../../../app/slices/vocabs-slice";

export interface ManageWbProps {
  keepMounted: boolean;
  open: boolean;
  onClose: () => void;
  wb?: workbookType;
}

export default function ManageWorkbook(props: ManageWbProps) {
  const dispatch = useAppDispatch();
  const [notIncludedVocs, setNotIncludedVocs] = React.useState<Vocab[]>([]);
  const [includedVocs, setIncludedVocs] = React.useState<Vocab[]>([]);
  const [removedWb, setRemovedWb] = React.useState<Vocab[]>([]);
  const [newWb, setNewWb] = React.useState<Vocab[]>([]);
  const [wbName, setWbName] = React.useState("");
  const { onClose, open, wb, ...other } = props;
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { currentLang, nativeLang } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  let wbVocs: Vocab[] = [];
  if (wb) wbVocs = allVocabs.getWbVocs(wb.id);
  let disabled = true;
  if (wbName !== "") disabled = false;

  const handleCancel = () => {
    onClose();
  };

  const handleUpdate = () => {
    if (!wb) return;
    newWb.forEach((voc) => voc.addWb(wb));
    removedWb.forEach((voc) => voc.removeWb(wb.id));
    newWb.forEach((voc) => dispatch(updateVocabLS(voc.getVocObj())));
    removedWb.forEach((voc) => dispatch(updateVocabLS(voc.getVocObj())));
    // !! TODO: lastupdated updaten in redux

    onClose();
  };

  const handleSubmit = () => {
    if (wb) return handleUpdate();
    const timeStamp = Date.now();
    const newWb: workbookType = {
      name: wbName,
      id: nanoid(),
      vocLanguage: currentLang,
      transLanguage: nativeLang,
      // vocCount: includedVocs.length,
      score: 0,
      createdAt: timeStamp,
      createdBy: uid,
      lastLearned: 0,
      lastUpdated: timeStamp,
    };
    includedVocs.forEach((voc) => voc.addWb(newWb));
    includedVocs.forEach((voc) => dispatch(updateVocabLS(voc.getVocObj())));
    dispatch(addWorkbook(newWb));
    setIncludedVocs([]);
    setNotIncludedVocs(allVocabs.getAllVocs());
    onClose();
  };

  const handleEntering = () => {
    // if (radioGroupRef.current != null) {
    //   radioGroupRef.current.focus();
    // }
  };

  const addClickHandler = (voc: Vocab) => {
    setIncludedVocs((cur) => [...cur, voc]);
    setNotIncludedVocs((cur) => cur.filter((el) => el.getId() !== voc.getId()));
    if (!wb) return;
    const removedCheck = removedWb.find((el) => el.getId() === voc.getId());
    setNewWb((cur) => [...cur, voc]);
    if (removedCheck)
      setRemovedWb((cur) => cur.filter((el) => el.getId() === voc.getId()));
  };
  const removeClickHandler = (voc: Vocab) => {
    setNotIncludedVocs((cur) => [...cur, voc]);
    setIncludedVocs((cur) => cur.filter((el) => el.getId() !== voc.getId()));
    if (!wb) return;
    const newCheck = newWb.find((el) => el.getId() === voc.getId());
    setRemovedWb((cur) => [...cur, voc]);
    if (newCheck)
      setNewWb((cur) => cur.filter((el) => el.getId() === voc.getId()));
  };

  React.useEffect(() => {
    if (!wb) return setNotIncludedVocs(allVocabs.getAllVocs());
    setWbName(wb.name);
    const notIncluded = allVocabs.getNotWbVocs(wb.id);
    // const included = allVocabs.getWbVocs(wb.id);
    setIncludedVocs(wbVocs);
    setNotIncludedVocs(notIncluded);
  }, [open]);

  return (
    <Dialog
      sx={{ "& .MuiDialog-paper": { width: "80%" } }}
      maxWidth="sm"
      fullWidth
      TransitionProps={{ onEntering: handleEntering }}
      open={open}
      onClose={onClose}
      {...other}
    >
      <DialogTitle>
        <TextField
          disabled={wb ? true : false}
          onChange={(e) => setWbName(e.currentTarget.value)}
          variant="outlined"
          value={wb && wb.name}
          size="medium"
          label="Workbook name"
          fullWidth
          // sx={{
          //   justifyContent: "center",
          //   alignItems: "center",
          // }}
          // style={{ textAlign: "center" }}
        />
      </DialogTitle>
      <DialogContent dividers>
        <Grid
          mt={0}
          container
          spacing={0.5}
          direction="row"
          justifyContent="center"
          alignItems="center"
          columns={2}
        >
          <Grid item xs={1} alignSelf={"start"}>
            <Typography variant="body2" pb={0} textAlign="center">
              Add Vocabs
            </Typography>
            <TextField
              size="small"
              label="search vocab"
              variant="standard"
              fullWidth
            />
            <VirtualizedList
              vocabs={notIncludedVocs}
              clickHandler={addClickHandler}
            />
          </Grid>
          {/* <Divider orientation="" /> */}
          <Grid item xs={1} alignSelf={"start"}>
            <Typography variant="body2" textAlign="center">
              Remove Vocabs
            </Typography>
            <TextField
              variant="standard"
              size="small"
              label="search vocab"
              fullWidth
            />
            <VirtualizedList
              vocabs={includedVocs}
              clickHandler={removeClickHandler}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={handleCancel}>
          Cancel
        </Button>
        <Button disabled={disabled} onClick={handleSubmit}>
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
