import { MouseEvent, useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  TextField,
  Switch,
} from "@mui/material";
import MoreIcon from "@mui/icons-material/MoreVert";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import {
  changeMaxShownVocs,
  keepScreenSettings,
} from "../../../app/slices/settings-slice";

type Props = {};

const OptionsMenu = (props: Props) => {
  const dispatch = useAppDispatch();
  const { vocabScreenSettings } = useAppSelector((state) => state.settings);
  const { maxVocs } = vocabScreenSettings;
  const [newMaxVocs, setNewMaxVocs] = useState(maxVocs);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  let defMaxVocs = maxVocs;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    if (maxVocs !== newMaxVocs) dispatch(changeMaxShownVocs(newMaxVocs));
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        edge="end"
        aria-label="options-menu"
        color="inherit"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <MoreIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}
        >
          <Typography variant="body1">Keep Filtersettings on Reload</Typography>
          <Switch
            aria-label="keep settings switch"
            value="keep Settingss"
            checked={vocabScreenSettings.keepSettings}
            onChange={() =>
              dispatch(keepScreenSettings(!vocabScreenSettings.keepSettings))
            }
          />
        </MenuItem>
        <Box display="flex" justifyContent="center" p={1}>
          {/* <Typography>Vocabs on 1 page:</Typography> */}
          <TextField
            value={newMaxVocs}
            type="number"
            required
            onChange={(e) => {
              const val = +e.currentTarget.value;
              if (val > 0 && val < 501) setNewMaxVocs(+e.currentTarget.value);
            }}
            label="Vocabs per page"
          />
        </Box>
        {/* <MenuItem onClick={handleClose}>Profile</MenuItem> */}
      </Menu>
    </>
  );
};

export default OptionsMenu;
