import { Typography, Box, TextField } from "@mui/material";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import React, { useEffect, useState } from "react";
import ContactsList from "../../components/contacts/contacts-list";
import { Contact, Friend, OnlineUser } from "../../logic/types/user.types";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import PersonIcon from "@mui/icons-material/Person";
import { blue } from "@mui/material/colors";
import { User } from "firebase/auth";
import { getUsers } from "../../utils/firebase";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { addFriend } from "../../app/slices/user-slice";

export interface SimpleDialogProps {
  open: boolean;
  selectedValue: string;
  onClose: (value: string) => void;
}

function AddDialog(props: SimpleDialogProps) {
  const { currentUser } = useAppSelector((state) => state.user);
  const { onClose, selectedValue, open } = props;
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<OnlineUser[]>([]);
  const [searchField, setSearchField] = useState("");
  const dispatch = useAppDispatch();

  useEffect(() => {
    const loadUsers = async () => {
      if (!currentUser) return;
      const users = await getUsers();
      const newUsers = users.filter((user) => user.id !== currentUser.uid);
      setUsers(newUsers);
      setFilteredUsers(newUsers);
    };
    loadUsers();
    // const dummieUsers = [
    //   { name: "horst", id: "fadj", email: "horst@das.de" },
    //   { name: "Karl", id: "fadj", email: "walter@das.de" },
    //   { name: "nuri", id: "fadj", email: "cooli@das.de" },
    //   { name: "Barbara", id: "fadj", email: "Barbara@das.de" },
    // ];
    // setUsers(dummieUsers);
    // setFilteredUsers(dummieUsers);
  }, []);

  const handleClose = () => {
    onClose(selectedValue);
  };

  useEffect(() => {
    console.log(searchField);
    const filUsr = users.filter((user) => {
      if (
        user.name.toLowerCase().includes(searchField.toLocaleLowerCase()) ===
          true ||
        user.email.toLowerCase().includes(searchField.toLocaleLowerCase()) ===
          true
      )
        return true;
    });
    setFilteredUsers(filUsr);
  }, [searchField]);

  const handleListItemClick = (value: string) => {
    console.log(value);
    const newFriend: Friend = {
      id: value,
      lastInteraction: Date.now(),

      conversation: "",
    };

    dispatch(addFriend(newFriend));
    onClose(value);
  };

  return (
    <Dialog onClose={handleClose} open={open}>
      <DialogTitle>Find a Friend</DialogTitle>
      <TextField
        value={searchField}
        onChange={(e) => {
          setSearchField(e.currentTarget.value);
        }}
      />
      <List sx={{ pt: 0 }}>
        {filteredUsers.map((user) => (
          <ListItem disableGutters={false}>
            <ListItemButton
              onClick={() => handleListItemClick(user.id)}
              key={user.id}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: blue[100], color: blue[600] }}>
                  <PersonIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={user.name} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disableGutters>
          <ListItemButton
            autoFocus
            onClick={() => handleListItemClick("addAccount")}
          >
            <ListItemAvatar>
              <Avatar>
                <AddIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary="Add account" />
          </ListItemButton>
        </ListItem>
      </List>
    </Dialog>
  );
}

const ContactScreen = () => {
  const [open, setOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState("");

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = (value: string) => {
    setOpen(false);
    setSelectedValue(value);
  };

  return (
    <>
      <div
        className="contacts-container"
        style={{
          display: "flex",
          height: "100%",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <header className="contacts-header">
          <Typography variant="h6">Contacts</Typography>
        </header>
        <main>
          <div className="flex-container">
            <ContactsList />
            <Fab
              color="primary"
              aria-label="add"
              size="small"
              onClick={handleClickOpen}
              sx={{ position: "relative" }}
            >
              <AddIcon />
            </Fab>
          </div>
          <AddDialog
            selectedValue={selectedValue}
            open={open}
            onClose={handleClose}
          />
        </main>
      </div>
    </>
  );
};

export default ContactScreen;
