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
import { countryCodes } from "../../utils/constants/countrieCodes";
import { setActiveLange } from "../../app/slices/learning-slice";

export type RouteTypes =
  | "default"
  | "random"
  | "workbook"
  | "mistakes"
  | undefined;

const LearningScreen = () => {
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { allUserVocabs, currentLang } = useAppSelector((s) => s.vocabs);
  const { vocabLearnSettings } = useAppSelector((state) => state.settings);
  const { started, route, activeLang } = useAppSelector(
    (state) => state.learning
  );
  const [languages, setLanguages] = useState<string[][]>([["All", "eu"]]);
  const [noVocs, setNoVocs] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const matches = useMediaQuery("(min-width:750px)");

  useEffect(() => {
    if (allVocabs.getVocCount() === 0) {
      const loadedVocs: AllVocabsClass = new AllVocabsClass([]);
      allUserVocabs.forEach((voc) => loadedVocs.addVocab(new Vocab(voc)));
      if (loadedVocs.getVocCount() != 0) dispatch(setAllVocabs(loadedVocs));
      else setNoVocs(true);
    } else {
      const langs = allVocabs.getVocLangs().map((lang) => {
        let code = countryCodes[lang as keyof typeof countryCodes];

        return [lang, code];
      });
      setLanguages([["All", "eu"], ...langs]);
    }
    if (activeLang === "None") dispatch(setActiveLange(currentLang));
  }, [allVocabs]);

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
      <Box>
        <Typography variant="h6">Choose Vocab Language: </Typography>
        <Select
          variant="standard"
          id="cur-trans-lang"
          size="small"
          label="Translation Language"
          value={activeLang}
          onChange={(e) => {
            dispatch(setActiveLange(e.target.value));
          }}
        >
          {languages.map((lang) => (
            <MenuItem key={lang[0]} value={lang[0]}>
              <img
                src={`https://flagcdn.com/16x12/${lang[1]}.png`}
                srcSet={`https://flagcdn.com/32x24/${lang[1]}.png 2x, https://flagcdn.com/48x36/${lang[1]}.png 3x`}
                width="16"
                height="12"
                style={{ marginRight: 10 }}
                alt={`${lang[0]} Flag`}
              ></img>
              {lang[0]}
            </MenuItem>
          ))}
        </Select>
      </Box>
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
            link={noVocs ? "/vocab/learning/" : "/vocab/learning/default"}
          />
          <StyledGridItem
            xs={2}
            text="Workbook"
            link={noVocs ? "/vocab/learning/" : "/vocab/learning/workbook"}
          />
          <StyledGridItem
            xs={1}
            text="Some random Vocabs"
            link={noVocs ? "/vocab/learning/" : "/vocab/learning/random"}
          />
          <StyledGridItem
            xs={1}
            text="Redeem yourself by learning your last mistakes!"
            link={noVocs ? "/vocab/learning/" : "/vocab/learning/mistakes"}
          />
        </Grid>
      </>
    </Box>
  );
};

export default LearningScreen;
