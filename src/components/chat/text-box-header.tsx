import {
  Typography,
  Box,
  Divider,
  Tooltip,
  Stack,
  Avatar,
  Button,
  Chip,
  TextField,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
// import {SearchIcon} from '@mui/icons-material';
import React from "react";
import { deleteField } from "firebase/firestore";
import { removeFriend } from "../../app/slices/user-slice";
import { deleteContact } from "../../utils/firebase";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { switchActiveConv } from "../../app/slices/conversation-slice";
import { useNavigate } from "react-router-dom";

const ChatBoxHeader = ({
  names,
  searchFunc,
  resetSearch,
  cIds,
}: {
  names: string;
  searchFunc: (val: string) => void;
  resetSearch: () => void;
  cIds: string[];
}) => {
  const [open, setOpen] = React.useState(false);
  const [deleteReq, setDeleteReq] = React.useState(false);
  const [searchType, setSearchType] = React.useState("");
  const nav = useNavigate();
  const [confirm, setConfirm] = React.useState(false);
  const dispatch = useAppDispatch();
  const { id: uid, friends } = useAppSelector((state) => state.user);
  const handleClick = () => {
    setOpen((cur) => !cur);
  };
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchType(e.currentTarget.value);
  };
  const handleAvatarClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = async () => {
    console.log(cIds);
    const friend = friends.find((el) => cIds.includes(el.id));
    console.log(friend);
    if (!friend) return;
    try {
      const newFriends = friends.filter((el) => el.id !== friend.id);
      await deleteContact(uid, friend, newFriends, friend.conversation);
      dispatch(removeFriend(friend));
      dispatch(switchActiveConv(""));
      nav("/contacts");

      console.log("reached end");
    } catch {
      console.log("error");
    }
  };

  return (
    <Box mb={1}>
      <Stack direction="row">
        <Typography
          color="primary"
          fontWeight="bold"
          sx={{ flex: 1 }}
          variant="h6"
        >
          {names}
        </Typography>
        <Box>
          <Collapse
            orientation="horizontal"
            in={open}
            timeout="auto"
            unmountOnExit
          >
            <TextField
              size="small"
              autoFocus
              placeholder="Search"
              onKeyDown={(e) => {
                if (e.key === "Enter") searchFunc(searchType);
              }}
              onBlur={(e) => {
                if (e.currentTarget.value === "") {
                  setOpen(false);
                  resetSearch();
                } else searchFunc(searchType);
              }}
              onChange={handleInputChange}
            />
          </Collapse>
        </Box>
        <IconButton onClick={handleClick}>
          <SearchIcon />
        </IconButton>
        <span onClick={handleAvatarClick}>
          <Avatar src="/broken-image.jpg" />
        </span>
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={openMenu}
          onClose={handleClose}
          MenuListProps={{
            "aria-labelledby": "basic-button",
          }}
        >
          <MenuItem onClick={handleClose}>Profile</MenuItem>
          {!deleteReq ? (
            <MenuItem onClick={() => setDeleteReq(true)}>
              Delete Contact
            </MenuItem>
          ) : (
            <MenuItem disableRipple>
              Delete?{" "}
              <Button
                size="small"
                variant="contained"
                sx={{ mx: 1, p: 0.2 }}
                color="error"
                onClick={handleDelete}
              >
                yes
              </Button>
              <Button
                size="small"
                variant="contained"
                sx={{ p: 0.2 }}
                onClick={() => setDeleteReq(false)}
              >
                no
              </Button>
            </MenuItem>
          )}
        </Menu>
      </Stack>
    </Box>
  );
};

export default ChatBoxHeader;
