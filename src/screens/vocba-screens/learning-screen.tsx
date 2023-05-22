import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
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
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { useMediaQuery } from "@mui/material";

import StyledGridItem from "../../components/general/styled-grid-item";
import { changeDefaultVocCount } from "../../app/slices/settings-slice";

export type RouteTypes =
  | "default"
  | "random"
  | "workbook"
  | "mistakes"
  | undefined;

const LearningScreen = () => {
  // const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { vocabLearnSettings } = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const matches = useMediaQuery("(min-width:750px)");

  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (
      anchorRef.current &&
      anchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }

    setOpen(false);
  };

  function handleListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Tab") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

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
                  aria-labelledby="composition-button"
                  onKeyDown={handleListKeyDown}
                >
                  <MenuItem>
                    Set Default Vocab Count:
                    <TextField
                      size="small"
                      type="number"
                      defaultValue={vocabLearnSettings.defaultVocCount}
                      onChange={(e) =>
                        dispatch(changeDefaultVocCount(+e.currentTarget.value))
                      }
                      sx={{ width: 100, ml: 2 }}
                    />
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
            link="/vocab/learning/default"
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
