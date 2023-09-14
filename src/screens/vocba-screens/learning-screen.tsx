import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Tooltip,
  Grid,
  Fab,
  Menu,
  Popper,
  MenuList,
  MenuItem,
  ClickAwayListener,
  Grow,
  Paper,
  TextField,
  Switch,
  Select,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { useMediaQuery } from "@mui/material";

import StyledGridItem from "../../components/general/styled-grid-item";
import {
  VocCheckingMode,
  changeDefaultVocCount,
  changeMaxWbVocCount,
  changeVocTimeout,
  setRethrowMistakes,
  setVocCheckingMode,
} from "../../app/slices/settings-slice";
import { useNavigate } from "react-router-dom";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";
import { setAllVocabs } from "../../app/slices/vocabs-class-slice";

export type RouteTypes =
  | "default"
  | "random"
  | "workbook"
  | "mistakes"
  | undefined;

const LearningScreen = () => {
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { allUserVocabs } = useAppSelector((s) => s.vocabs);
  const { vocabLearnSettings } = useAppSelector((state) => state.settings);
  const { started, route } = useAppSelector((state) => state.learning);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const matches = useMediaQuery("(min-width:750px)");

  useEffect(() => {
    if (allVocabs.getVocCount() === 0) {
      const loadedVocs: AllVocabsClass = new AllVocabsClass([]);
      allUserVocabs.forEach((voc) => loadedVocs.addVocab(new Vocab(voc)));
      dispatch(setAllVocabs(loadedVocs));
    }
  }, []);

  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (
      anchorRef.current &&
      anchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }

    // setOpen(false);
  };

  function handleListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Tab") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (started) navigate(`/vocab/learning/${route}`);

  return (
    <Box>
      <Typography variant="h5">Choose your learning route!</Typography>
      <Fab
        color="primary"
        aria-label="Learn Settings"
        size="small"
        sx={{ position: "absolute", top: "80px", right: "5%" }}
        ref={anchorRef}
        onClick={() => setOpen((cur) => !cur)}
      >
        <SettingsIcon />
      </Fab>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        placement="bottom-start"
        transition
        disablePortal
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin:
                placement === "bottom-start" ? "left top" : "left bottom",
            }}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList
                  autoFocusItem={open}
                  id="composition-menu"
                  aria-labelledby="Learning-options-button"
                  onKeyDown={handleListKeyDown}
                >
                  <MenuItem disableRipple>
                    Set Default Vocab Count:
                    <TextField
                      size="small"
                      type="number"
                      defaultValue={vocabLearnSettings.defaultVocCount}
                      onChange={(e) => {
                        const val = +e.currentTarget.value;
                        if (val < 1) e.currentTarget.value = "1";
                        dispatch(changeDefaultVocCount(+e.currentTarget.value));
                      }}
                      sx={{ width: 100, ml: 2 }}
                    />
                  </MenuItem>

                  <MenuItem disableRipple>
                    Set max WB Vocab Count:
                    <TextField
                      size="small"
                      type="number"
                      defaultValue={vocabLearnSettings.maxWbVocs}
                      onChange={(e) => {
                        const val = +e.currentTarget.value;
                        if (val < 1) e.currentTarget.value = "1";
                        if (val > 200) e.currentTarget.value = "200";
                        dispatch(changeMaxWbVocCount(+e.currentTarget.value));
                      }}
                      sx={{ width: 100, ml: 2 }}
                    />
                  </MenuItem>
                  <Tooltip
                    arrow
                    disableInteractive
                    title="The time in minutes in which recently learned vocabs don't reappear"
                  >
                    <MenuItem
                      disableRipple
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography>Set Vocab Timeout (min):</Typography>
                      <TextField
                        size="small"
                        type="number"
                        defaultValue={vocabLearnSettings.vocabTimeOut}
                        onChange={(e) => {
                          const val = +e.currentTarget.value;
                          if (val < 1) e.currentTarget.value = "1";
                          dispatch(changeVocTimeout(+e.currentTarget.value));
                        }}
                        sx={{ width: 100, ml: 2 }}
                      />
                    </MenuItem>
                  </Tooltip>
                  <Tooltip
                    arrow
                    disableInteractive
                    title="If disabled, wrong answered vocabs of recent learn sessions reappear despite timeout"
                  >
                    <MenuItem
                      disableRipple
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography>Rethrow mistakes: </Typography>
                      <Switch
                        value="RethrowMistakes"
                        onChange={(e) => {
                          dispatch(setRethrowMistakes(e.currentTarget.checked));
                        }}
                        checked={vocabLearnSettings.rethrowMistakes}
                        name="Rethrow Mistakes"
                      />
                    </MenuItem>
                  </Tooltip>

                  <MenuItem
                    disableRipple
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Tooltip
                      arrow
                      disableInteractive
                      title="In strict mode: Case-sensetive, normal: not Case-sensetive, loose: Little Typos do not matter"
                    >
                      <Typography>Set checking conditions:</Typography>
                    </Tooltip>
                    <Select
                      labelId="checking-condition-selection"
                      id="checking-condition-selection"
                      value={vocabLearnSettings.checkingConditions}
                      onChange={(e) => {
                        const val = e.target.value;
                        dispatch(setVocCheckingMode(val as VocCheckingMode));
                      }}
                      sx={{ width: 100 }}
                      label="Checking condition"
                    >
                      <MenuItem value="strict">Strict</MenuItem>
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="loose">Loose</MenuItem>
                    </Select>
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
      <>
        <Grid
          mt={0}
          container
          spacing={3}
          direction="row"
          justifyContent="center"
          alignItems="center"
          columns={matches ? 2 : 1}
        >
          <StyledGridItem
            xs={2}
            text="Default Route!"
            link={"/vocab/learning/default"}
          />
          <StyledGridItem
            xs={2}
            text="Workbook"
            link="/vocab/learning/workbook"
          />
          <StyledGridItem
            xs={1}
            text="Some random Vocabs"
            link="/vocab/learning/random"
          />
          <StyledGridItem
            xs={1}
            text="Redeem yourself by learning your last mistakes!"
            link="/vocab/learning/mistakes"
          />
        </Grid>
      </>
    </Box>
  );
};

export default LearningScreen;
