import { MouseEvent, useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  TextField,
} from "@mui/material";
import MoreIcon from "@mui/icons-material/MoreVert";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { changeMaxShownVocs } from "../../../app/slices/settings-slice";

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
        <Box p={1}>
          {/* <Typography>Vocabs on 1 page:</Typography> */}
          <TextField
            value={newMaxVocs}
            type="number"
            onChange={(e) => setNewMaxVocs(+e.currentTarget.value)}
            label="Vocabs on 1 page"
          />
        </Box>
        {/* <MenuItem onClick={handleClose}>Profile</MenuItem> */}
      </Menu>
    </>
  );
};

export default OptionsMenu;
