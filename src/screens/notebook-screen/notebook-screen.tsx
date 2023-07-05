import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Collapse,
  ListItem,
  Button,
  TextField,
  IconButton,
  Stack,
  Divider,
  Menu,
  MenuItem,
  Switch,
  List,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import FlatList from "flatlist-react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PostAddIcon from "@mui/icons-material/PostAdd";
import SearchIcon from "@mui/icons-material/Search";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { addNote, deleteNote, updateNote } from "../../app/slices/notes-slice";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "@reduxjs/toolkit";
import {
  changeNoteFilter,
  changeNoteShowChecked,
} from "../../app/slices/settings-slice";

export type Note = {
  id: string;
  type: "message" | "note";
  language: string;
  message: string;
  sender: string;
  sendTime: number;
  savedTime: number;
  checked: boolean;
  note?: string;
  date?: string;
  ref: { conversation: string; msgId: string };
};

const NotebookScreen = () => {
  const dispatch = useAppDispatch();
  const [open, setOpen] = React.useState(false);
  const [openFilter, setOpenFilter] = React.useState(false);
  const handleClick = () => {
    setOpen((cur) => !cur);
  };
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { id: uid } = useAppSelector((state) => state.user);
  const { theme, notebookFilterSet } = useAppSelector(
    (state) => state.settings
  );
  const { notes: noteStore } = useAppSelector((state) => state.notes);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    setNotes(noteStore);
  }, [notes]);

  const bgColor = theme === "dark" ? "#1c1d2b" : "#bbdefb";
  const itemColor = theme === "dark" ? "#263238" : "#90caf9";
  const itemHover = theme === "dark" ? "#37474f" : "#64b5f6";

  const clickHandler = (note: Note) => {
    console.log(note);
  };

  const renderNote = (note: Note, idx: string) => {
    let type = "message";
    if (note.sender === uid) type = "note";
    let position = "flex-start";
    if (type === "note") position = "flex-end";

    return (
      <ListItem
        sx={{
          my: 1,
          p: 0,
          justifyContent: position,
        }}
        key={idx}
        onClick={() => console.log(note)}
      >
        <Box
          bgcolor={itemColor}
          p={1.5}
          borderRadius={2}
          sx={{
            ":hover": {
              cursor: "pointer",
              bgcolor: itemHover,
            },
          }}
        >
          <Typography color={theme === "light" ? "black" : ""} variant="body1">
            {note.message}
          </Typography>
          {note.note && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Typography
                color={theme === "light" ? "black" : ""}
                variant="body2"
              >
                {note.note}
              </Typography>
            </>
          )}
          <Divider />
          <Box display="flex" justifyContent="flex-end" mt={0.3}>
            <IconButton
              sx={{ p: 0 }}
              size="small"
              onClick={() => dispatch(deleteNote(note))}
            >
              <DeleteIcon />
            </IconButton>
            <Divider sx={{ mx: 0.5, height: 20 }} orientation="vertical" />
            <IconButton
              onClick={() => {
                const updatedNote: Note = { ...note, checked: !note.checked };
                console.log("dispatch: ", updatedNote);
                dispatch(updateNote(updatedNote));
              }}
              size="small"
              sx={{ p: 0 }}
            >
              <CheckCircleOutlineIcon
                color={note.checked ? "success" : "disabled"}
              />
            </IconButton>
          </Box>
        </Box>
      </ListItem>
    );
  };

  return (
    <Box>
      <Box mt={1} p={1} mb={0} sx={{ bgcolor: bgColor, borderRadius: "5px" }}>
        <Box
          id="notebook-header"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          height={40}
        >
          <Typography sx={{ p: 1 }} variant="h6" align="center">
            All Notes
          </Typography>
          <Box display="flex" height={40}>
            <Box display="flex" height={40} mr={1}>
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
                  //   onKeyDown={(e) => {
                  //     if (e.key === "Enter") searchFunc(searchType);
                  //   }}
                  //   onBlur={(e) => {
                  //     if (e.currentTarget.value === "") {
                  //       setOpen(false);
                  //       resetSearch();
                  //     } else searchFunc(searchType);
                  //   }}
                  onChange={(e) => setSearchTerm(e.currentTarget.value)}
                />
              </Collapse>

              <IconButton onClick={handleClick}>
                <SearchIcon />
              </IconButton>
            </Box>
            <Divider orientation="vertical" />
            <Button
              id="filter-menu-button"
              aria-controls={open ? "notebook-filter-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={open ? "true" : undefined}
              onClick={handleFilterClick}
              endIcon={<ExpandMoreIcon />}
            >
              Filter
            </Button>
            <Menu
              id="filter-menu"
              anchorEl={anchorEl}
              open={openMenu}
              onClose={handleClose}
              MenuListProps={{
                "aria-labelledby": "basic-button",
              }}
            >
              <MenuItem disableRipple>
                Show Checked Notes
                <Switch
                  value="showChecked"
                  onChange={(e) => {
                    dispatch(
                      changeNoteShowChecked(!notebookFilterSet.showChecked)
                    );
                  }}
                  checked={notebookFilterSet.showChecked}
                  name="Show Importance"
                />
              </MenuItem>
              <MenuItem>
                <Typography>Filter By</Typography>
                <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                  {/* <InputLabel id="demo-simple-select-standard-label">
                    Age
                  </InputLabel> */}
                  <Select
                    labelId="demo-simple-select-standard-label"
                    id="demo-simple-select-standard"
                    value={notebookFilterSet.filterBy}
                    onChange={(e) => {
                      console.log(e.target.value);
                      const val = e.target.value;
                      if (
                        val === "language" ||
                        val === "none" ||
                        val === "sender"
                      )
                        dispatch(changeNoteFilter(val));
                    }}
                    label="Filter"
                  >
                    <MenuItem value={"none"}>None</MenuItem>
                    <MenuItem value={"language"}>language</MenuItem>
                    <MenuItem value={"creater"}>creater</MenuItem>
                  </Select>
                </FormControl>
              </MenuItem>
              {notebookFilterSet.filterBy === "language" && (
                <MenuItem>
                  <Typography>Language</Typography>
                  <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                    <Select
                      labelId="filter-language-select-label"
                      id="filter-language-select"
                      value={
                        notebookFilterSet.language
                          ? notebookFilterSet.language
                          : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        // dispatch(changeNoteFilter(val));
                      }}
                      label="language"
                    >
                      <MenuItem value={"Farsi"}>Farsi</MenuItem>
                      <MenuItem value={"German"}>German</MenuItem>
                      <MenuItem value={"English"}>English</MenuItem>
                    </Select>
                  </FormControl>
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>
        <Divider sx={{ mt: 1 }} />
        <Box overflow={"auto"} maxHeight={"70dvh"} mt={2}>
          <ul>
            <FlatList
              list={noteStore}
              renderItem={renderNote}
              renderWhenEmpty={() => (
                <div>
                  No notes yet!{" "}
                  <Button
                    onClick={() => {
                      const id = nanoid();
                      dispatch(
                        addNote({
                          id,
                          type: "message",
                          language: "farsi",
                          message: `message with the proud number of`,
                          checked: false,
                          note: undefined,
                          sender: uid,
                          sendTime: Date.now() - 10000000,
                          savedTime: Date.now() - 8000000,
                          date: new Date(
                            Date.now() - 8000000
                          ).toLocaleDateString(),
                          ref: { conversation: "alkdfa", msgId: "aflae" },
                        })
                      );
                    }}
                  >
                    Add Note!
                  </Button>{" "}
                </div>
              )}
              scrollToTop
              // limit="500"
              searchBy={["message"]}
              searchTerm={searchTerm}
              renderOnScroll
              groupBy={"date"}
              filterBy={(note) => {
                if (!notebookFilterSet.showChecked) return !note.checked;
                return true;
              }}
              groupSeparator={(group, idx, groupLabel) => (
                <Divider>{groupLabel}</Divider>
              )}
              // sortBy={["firstName", {key: "lastName", descending: true}]}
              // groupBy={person => person.info.age > 18 ? 'Over 18' : 'Under 18'}
            />
          </ul>
          {/* <List>
            {notes.length > 0 ? (
              notes.map((note) => <RenderNote note={note} />)
            ) : (
              <Box>
                No Notes yet!{" "}
                <Button
                  onClick={() =>
                    dispatch(
                      addNote({
                        id: `afw321`,
                        type: "message",
                        language: "farsi",
                        message: `message with the proud number of`,
                        checked: false,
                        note: undefined,
                        sender: uid,
                        sendTime: Date.now() - 10000000,
                        savedTime: Date.now() - 8000000,
                        date: new Date(
                          Date.now() - 8000000
                        ).toLocaleDateString(),
                        ref: { conversation: "alkdfa", msgId: "aflae" },
                      })
                    )
                  }
                >
                  Add Note!
                </Button>
              </Box>
            )}
          </List> */}
        </Box>
        <Box>
          <IconButton
            size="small"
            onClick={() =>
              dispatch(
                addNote({
                  id: nanoid(),
                  type: "message",
                  language: "farsi",
                  message: `message with the proud number of`,
                  checked: false,
                  note: undefined,
                  sender: uid,
                  sendTime: Date.now() - 10000000,
                  savedTime: Date.now() - 8000000,
                  date: new Date(Date.now() - 8000000).toLocaleDateString(),
                  ref: { conversation: "alkdfa", msgId: "aflae" },
                })
              )
            }
          >
            <PostAddIcon />
          </IconButton>
        </Box>
      </Box>
      <Dialog>
        <DialogTitle>Add a Note</DialogTitle>
        <DialogContent
      </Dialog>
    </Box>
  );
};

export default NotebookScreen;
