import {
  Avatar,
  Dialog,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  TextField,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { addFriend, reAddFriend } from "../../app/slices/user-slice";
import { Friend, OnlineUser } from "../../logic/types/user.types";
import { getUsers } from "../../utils/firebase";
import { blue } from "@mui/material/colors";

export interface SimpleDialogProps {
  open: boolean;
  selectedValue: string;
  onClose: (value: string) => void;
}

function AddDialog(props: SimpleDialogProps) {
  const { friends, id, deletedFriends } = useAppSelector((state) => state.user);
  const { onClose, selectedValue, open } = props;
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<OnlineUser[]>([]);
  const [searchField, setSearchField] = useState("");
  const dispatch = useAppDispatch();

  // loading the users from db and excluding friends
  useEffect(() => {
    const loadUsers = async () => {
      const frIds: string[] = [];
      friends.forEach((fr) => frIds.push(fr.id));
      if (id === "") return;
      const users = await getUsers();
      const newUsers = users.filter((user) => {
        if (user.id === id || frIds.includes(user.id)) return false;
        else return true;
      });
      setUsers(newUsers);
      setFilteredUsers(newUsers);
    };
    loadUsers();
  }, []);

  const handleClose = () => {
    onClose(selectedValue);
  };

  // filtering useres with typing
  useEffect(() => {
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

  // adding new friend from users in redux store the user will be added to the DB in the store
  // conversations will be added with the click on the contact in the contact-list
  const handleListItemClick = (user: OnlineUser) => {
    // checking if users were friends before

    const friend = deletedFriends.find((el) => el.id === user.id);

    if (friend) return dispatch(reAddFriend(friend));

    const newFriend: Friend = {
      id: user.id,
      lastInteraction: Date.now(),
      lastMessage: "",
      conversation: "",
      name: user.name,
    };

    dispatch(addFriend(newFriend));
    onClose(user.id);
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
          <ListItem key={user.id} disableGutters={false}>
            <ListItemButton
              onClick={() => handleListItemClick(user)}
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
        <ListItem disableGutters></ListItem>
      </List>
    </Dialog>
  );
}

export default AddDialog;
