import React, { useLayoutEffect, useState } from "react";
import {
  Box,
  Typography,
  Collapse,
  ListItem,
  Button,
  TextField,
  IconButton,
  Divider,
  Menu,
  MenuItem,
  Switch,
  FormControl,
  Select,
  Skeleton,
} from "@mui/material";
import FlatList from "flatlist-react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PostAddIcon from "@mui/icons-material/PostAdd";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { addNote, deleteNote, updateNote } from "../../app/slices/notes-slice";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  changeNoteFiltLang,
  changeNoteFilter,
  changeNoteSender,
  changeNoteShowChecked,
} from "../../app/slices/settings-slice";
import { Note } from "../../logic/types/note.types";
import NoteAddDialog from "../../components/notes/note-add-dialog";
import { deleteNoteDb, getAllNotes } from "../../utils/firebase/firebase-notes";

// um die Flickering zu vermeiden, die Flatlist mit render in eigene komponente
// Packen und uid etc mit "isLoading" im useEffect verbinden

const NotebookScreen = () => {
  const dispatch = useAppDispatch();
  const [open, setOpen] = React.useState(false);
  const [openAdd, setOpenAdd] = React.useState(false);
  const [editNote, setEditNote] = useState<undefined | Note>(undefined);
  const handleClick = () => {
    setOpen((cur) => !cur);
  };
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setOpenAdd(false);
  };
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reRender, setReRender] = useState(true);
  const { id: uid, friends } = useAppSelector((state) => state.user);
  const { theme, notebookFilterSet } = useAppSelector(
    (state) => state.settings
  );
  const { notes: noteStore, noteLangs } = useAppSelector(
    (state) => state.notes
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteCreator, setNoteCreator] = useState<string[][]>([]);

  useLayoutEffect(() => {
    // if (isLoading === true) return;
    // setIsLoading(true);
    if (uid === "" || !uid) return;
    const newNoteCreatorIds: string[] = [];
    setEditNote(undefined);
    setNotes(noteStore);
    noteStore.forEach((note) => {
      if (!newNoteCreatorIds.includes(note.sender))
        newNoteCreatorIds.push(note.sender);
    });
    const newNoteCreator: string[][] = newNoteCreatorIds.map((crId) => {
      if (crId === uid) {
        return [crId, "Me"];
      } else {
        const name = friends.find((friend) => friend.id === crId)?.name;
        return [crId, name || "No Name"];
      }
    });
    setNoteCreator(newNoteCreator);
    setIsLoading(false);
  }, [notes, uid, noteStore, reRender]);

  const loadNotes = async () => {
    setIsLoading(true);
    const loadedNotes = await getAllNotes(uid);
    loadedNotes.forEach((note) => dispatch(addNote(note)));
    setIsLoading(false);
    setReRender((cur) => !cur);
  };

  const bgColor = theme === "dark" ? "#1c1d2b" : "#bbdefb";
  const itemColor = theme === "dark" ? "#263238" : "#90caf9";
  const itemHover = theme === "dark" ? "#37474f" : "#64b5f6";

  const renderNote = (note: Note, idx: string) => {
    let type = "message";
    if (note.sender === uid) type = "note";
    let position = "flex-start";
    if (type === "note") position = "flex-end";

    return (
      <ListItem
        sx={{
          my: 0,
          justifyContent: position,
        }}
        key={idx}
      >
        <Box
          bgcolor={itemColor}
          p={1.5}
          px={2}
          borderRadius={2}
          minWidth={200}
          sx={{
            ":hover": {
              cursor: "pointer",
              bgcolor: itemHover,
            },
          }}
        >
          {note.message.map((msg, i) => {
            return (
              <Typography
                key={msg}
                color={theme === "light" ? "black" : ""}
                variant="body1"
              >
                {msg}
              </Typography>
            );
          })}

          {note.note && note.note.length > 0 && (
            <>
              <Divider sx={{ my: 0.5 }} />
              {note.note.map((text, i) => (
                <Typography
                  key={text}
                  color={theme === "light" ? "black" : ""}
                  variant="body2"
                >
                  {text}
                </Typography>
              ))}
            </>
          )}
          <Divider sx={{ mt: 0.5 }} />
          <Box display="flex" justifyContent="flex-end" mt={0.3}>
            <IconButton
              size="small"
              sx={{ p: 0, mx: 0.5 }}
              onClick={() => {
                setEditNote(note);
                setOpenAdd(true);
              }}
            >
              <EditIcon />
            </IconButton>
            {!note.delete ? (
              <IconButton
                sx={{ p: 0 }}
                size="small"
                onClick={() => {
                  const updatedNote: Note = { ...note, delete: true };
                  dispatch(updateNote({ note: updatedNote, uid }));
                }}
              >
                <DeleteIcon />
              </IconButton>
            ) : (
              <>
                <Button
                  color="error"
                  size="small"
                  onClick={() => {
                    // deleteNoteDb(note.id);
                    dispatch(deleteNote(note));
                  }}
                  endIcon={<DeleteIcon />}
                >
                  Confirm
                </Button>
                <IconButton
                  size="small"
                  onClick={() => {
                    const updatedNote: Note = { ...note, delete: false };
                    dispatch(updateNote({ note: updatedNote, uid }));
                  }}
                >
                  <CancelIcon />
                </IconButton>
              </>
            )}

            <Divider sx={{ mx: 0.5, height: 20 }} orientation="vertical" />
            <IconButton
              onClick={() => {
                const updatedNote: Note = { ...note, checked: !note.checked };
                dispatch(updateNote({ note: updatedNote, uid }));
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
            <Button onClick={loadNotes}>Load</Button>
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
                    <MenuItem value={"sender"}>creater</MenuItem>
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
                        dispatch(changeNoteFiltLang(val));
                      }}
                      label="language"
                    >
                      {noteLangs.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                          {lang}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </MenuItem>
              )}
              {notebookFilterSet.filterBy === "sender" && (
                <MenuItem>
                  <Typography>Creator</Typography>
                  <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                    <Select
                      labelId="filter-creator-select-label"
                      id="filter-creator-select"
                      value={
                        notebookFilterSet.sender ? notebookFilterSet.sender : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        dispatch(changeNoteSender(val as string));
                      }}
                      label="language"
                    >
                      {noteCreator.map((creator) => (
                        <MenuItem key={creator[0]} value={creator[0]}>
                          {creator[1]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>
        <Divider sx={{ mt: 1 }} />
        <Box overflow={"auto"} height={"70dvh"} mt={2}>
          {!isLoading ? (
            <ul>
              <FlatList
                list={noteStore}
                renderItem={renderNote}
                renderWhenEmpty={() => (
                  <>
                    {notebookFilterSet.filterBy === "language" ? (
                      <div>
                        No notes in that language!{" "}
                        <Button onClick={() => setOpenAdd(true)}>
                          Add a Note!
                        </Button>{" "}
                      </div>
                    ) : (
                      <div>
                        <Typography variant="h6">
                          No notes on your device!
                        </Typography>
                        <Typography variant="body1">
                          If you have notes stored in the database click on
                          Load!
                        </Typography>
                        <Button sx={{ m: 1 }} onClick={loadNotes}>
                          Load
                        </Button>
                        <Button sx={{ m: 1 }} onClick={() => setOpenAdd(true)}>
                          Add a Note!
                        </Button>{" "}
                      </div>
                    )}
                  </>
                )}
                scrollToTop
                // limit="500"
                searchBy={["message", "note"]}
                searchTerm={searchTerm}
                renderOnScroll
                reversed
                groupBy={"date"}
                filterBy={(note) => {
                  let check = true;
                  if (!notebookFilterSet.showChecked) check = !note.checked;
                  if (
                    notebookFilterSet.filterBy === "language" &&
                    notebookFilterSet.language &&
                    note.language !== notebookFilterSet.language
                  )
                    check = false;
                  if (
                    notebookFilterSet.filterBy === "sender" &&
                    notebookFilterSet.sender &&
                    note.sender !== notebookFilterSet.sender
                  )
                    check = false;
                  return check;
                }}
                groupSeparator={(group, idx, groupLabel) => (
                  <Divider>{groupLabel}</Divider>
                )}
                // sortBy={["firstName", {key: "lastName", descending: true}]}
                // groupBy={person => person.info.age > 18 ? 'Over 18' : 'Under 18'}
              />
            </ul>
          ) : (
            <Box maxHeight="70dvh">
              <Divider>
                <Typography width={100} variant="body2">
                  <Skeleton />
                </Typography>
              </Divider>
              <Skeleton
                sx={{ p: 1, m: 1 }}
                variant="rounded"
                height={75}
                width="50%"
              />
              <Skeleton
                sx={{ p: 1, m: 1 }}
                variant="rounded"
                height={85}
                width="70%"
              />
              <Box display="flex" flexDirection="row" justifyContent="flex-end">
                <Skeleton
                  sx={{ p: 1, m: 1 }}
                  variant="rounded"
                  height={100}
                  width="60%"
                />
              </Box>
              <Skeleton
                sx={{ p: 1, m: 1 }}
                variant="rounded"
                height={85}
                width="40%"
              />
              <Divider>
                <Typography width={100} variant="body2">
                  <Skeleton />
                </Typography>
              </Divider>
              <Box display="flex" flexDirection="row" justifyContent="flex-end">
                <Skeleton
                  sx={{ p: 1, m: 1 }}
                  variant="rounded"
                  height={90}
                  width="45%"
                />
              </Box>
              <Box display="flex" flexDirection="row" justifyContent="flex-end">
                <Skeleton
                  sx={{ p: 1, m: 1 }}
                  variant="rounded"
                  height={100}
                  width="80%"
                />
              </Box>
            </Box>
          )}
        </Box>
        <Box>
          <IconButton
            size="small"
            onClick={() => {
              setEditNote(undefined);
              setOpenAdd(true);
            }}
          >
            <PostAddIcon />
          </IconButton>
        </Box>
      </Box>
      <NoteAddDialog
        openAdd={openAdd}
        note={editNote}
        setOpenAdd={setOpenAdd}
      />
    </Box>
  );
};

export default NotebookScreen;
