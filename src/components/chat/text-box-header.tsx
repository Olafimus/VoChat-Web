import {
  Typography,
  Box,
  Divider,
  Tooltip,
  Stack,
  Avatar,
  Button,
  Checkbox,
  TextField,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  FormControlLabel,
  Select,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import React from "react";
import { deleteField } from "firebase/firestore";
import { removeFriend } from "../../app/slices/user-slice";
import { deleteContact } from "../../utils/firebase";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { switchActiveConv } from "../../app/slices/conversation-slice";
import { useNavigate } from "react-router-dom";
import { MsgHisTypes } from "../../logic/types/message.types";

const ChatBoxHeader = ({
  names,
  searchFunc,
  resetSearch,
  cIds,
  filterSet,
  setFilterSet,
}: {
  names: string;
  searchFunc: (val: string) => void;
  resetSearch: () => void;
  cIds: string[];
  filterSet: {
    lang: string;
    msgTypes: MsgHisTypes[];
  };
  setFilterSet: (val: { lang: string; msgTypes: MsgHisTypes[] }) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const [deleteReq, setDeleteReq] = React.useState(false);
  const [searchType, setSearchType] = React.useState("");
  const [allchecked, setAllChecked] = React.useState(true);
  const nav = useNavigate();
  const dispatch = useAppDispatch();
  const {
    id: uid,
    friends,
    teachLanguages,
    learnLanguages,
  } = useAppSelector((state) => state.user);

  const handleClick = () => {
    setOpen((cur) => !cur);
  };
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [anchorFilEl, setAnchorFilEl] = React.useState<null | HTMLElement>(
    null
  );
  const openMenu = Boolean(anchorEl);
  const openFilter = Boolean(anchorFilEl);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchType(e.currentTarget.value);
  };
  const handleAvatarClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleFilClose = () => {
    setAnchorFilEl(null);
  };

  const handleDelete = async () => {
    const friend = friends.find((el) => cIds.includes(el.id));
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

  const msgTypeOptions: { label: string; val: MsgHisTypes }[] = [
    { label: "Standard Messages", val: "standard" },
    { label: "Replies", val: "answer" },
    { label: "Edited Messages", val: "edit" },
    { label: "Vocabs", val: "vocab" },
    { label: "Workbooks", val: "wb" },
  ];

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
        <IconButton size="small" sx={{ mr: 1 }} onClick={handleClick}>
          <SearchIcon />
        </IconButton>
        <Tooltip title="Filter">
          <IconButton
            onClick={(e) => setAnchorFilEl(e.currentTarget)}
            size="small"
            sx={{ mr: 1 }}
          >
            <FilterListIcon />
          </IconButton>
        </Tooltip>
        <Menu
          id="Filter-menu"
          anchorEl={anchorFilEl}
          open={openFilter}
          onClose={handleFilClose}
          MenuListProps={{
            "aria-labelledby": "Filter-button",
          }}
        >
          <MenuItem sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography>All Types</Typography>{" "}
            <Checkbox
              checked={allchecked}
              onChange={() => {
                setFilterSet({
                  lang: filterSet.lang,
                  msgTypes: ["answer", "edit", "standard", "vocab", "wb"],
                });
                setAllChecked(true);
              }}
            />
          </MenuItem>

          {msgTypeOptions.map((option) => (
            <MenuItem
              key={option.label}
              sx={{ display: "flex", justifyContent: "space-between" }}
            >
              <Typography>{option.label}</Typography>{" "}
              <Checkbox
                checked={filterSet.msgTypes.includes(option.val)}
                onChange={() => {
                  let msgTypes: MsgHisTypes[] = [];
                  if (filterSet.msgTypes.includes(option.val))
                    msgTypes = filterSet.msgTypes.filter(
                      (el) => el !== option.val
                    );
                  else msgTypes = [...filterSet.msgTypes, option.val];
                  setFilterSet({ lang: filterSet.lang, msgTypes });
                  if (msgTypes.length === 5) setAllChecked(true);
                  else setAllChecked(false);
                }}
              />
            </MenuItem>
          ))}

          <MenuItem onClick={handleFilClose}>
            Lang:
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
              {/* <InputLabel id="demo-simple-select-standard-label">
                    Age
                  </InputLabel> */}
              <Select
                labelId="demo-simple-select-standard-label"
                id="demo-simple-select-standard"
                value={filterSet.lang}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterSet({ lang: val, msgTypes: filterSet.msgTypes });
                }}
                label="Filter"
              >
                <MenuItem value={"all"}>All</MenuItem>
                {[...teachLanguages, ...learnLanguages].map((lang) => {
                  if (!lang) return;
                  return (
                    <MenuItem key={lang} value={lang}>
                      {lang}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </MenuItem>
        </Menu>
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
