import {
  Avatar,
  Box,
  Divider,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useNavigate, useNavigation } from "react-router-dom";
import { PropTypes } from "../../logic/types/proptypes";
import { useDocument } from "react-firebase-hooks/firestore";
import { doc } from "firebase/firestore";
import { addConvToFriend, db, setConvDoc } from "../../utils/firebase";
import { Contact } from "../../logic/types/user.types";
import {
  Conversation,
  newConversation,
} from "../../logic/classes/conversation.class";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  addConversation,
  switchActiveConv,
} from "../../app/slices/conversation-slice";
import { addConvRef, addConvToFriendUser } from "../../app/slices/user-slice";
import { switchScreen } from "../../app/slices/settings-slice";

const ContactItem: React.FC<PropTypes> = ({ friend }) => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  const [loadedContact, setLoadedContact] = useState<{
    name: string;
    lastMessage: string;
  }>({ name: "", lastMessage: "" });

  const [value, loading, error] = useDocument(doc(db, "users", friend.id), {
    snapshotListenOptions: { includeMetadataChanges: true },
  });

  const clickHandler = () => {
    if (!user) return;
    if (friend.conversation === "") {
      const conv: Conversation = {
        ...newConversation,
        users: [user.id, friend.id],
      };
      setConvDoc(conv);
      addConvToFriend(friend.id, user.id, conv.id);
      dispatch(addConvRef(conv.id));
      dispatch(addConvToFriendUser({ fid: friend.id, convId: conv.id }));
      dispatch(switchActiveConv(conv.id));
    } else {
      dispatch(switchActiveConv(friend.conversation));
    }
    dispatch(switchScreen("chat"));
    navigate("/chat");
  };

  useEffect(() => {
    if (!value) return;
    const data = {
      name: value.data()?.displayName ?? "",
      lastMessage: loadedContact.lastMessage,
    };
    setLoadedContact(data);
  }, [value]);

  function stringToColor(string: string) {
    let hash = 0;
    let i;

    /* eslint-disable no-bitwise */
    for (i = 0; i < string.length; i += 1) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }

    let color = "#";

    for (i = 0; i < 3; i += 1) {
      const value = (hash >> (i * 8)) & 0xff;
      color += `00${value.toString(16)}`.slice(-2);
    }
    /* eslint-enable no-bitwise */

    return color;
  }

  function stringAvatar(name: string) {
    return {
      sx: {
        bgcolor: stringToColor(name),
      },
      children: `${name[0]}`,
    };
  }

  return (
    <>
      <ListItem
        alignItems="flex-start"
        sx={{ cursor: "pointer" }}
        onClick={clickHandler}
      >
        <ListItemAvatar>
          <Avatar alt="Remy Sharp" {...stringAvatar(loadedContact.name)} />
        </ListItemAvatar>
        <ListItemText
          primary={loadedContact.name}
          secondary={
            <React.Fragment>
              <Typography
                sx={{ display: "inline" }}
                component="span"
                variant="body2"
                color="text.primary"
              >
                {loadedContact.lastMessage}
              </Typography>
              {/* {`${loadedContact.lastMessage}`} */}
            </React.Fragment>
          }
        />
        <ListItemText
          sx={{
            display: "flex",
            alignSelf: "center",
            justifyContent: "flex-end",
            paddingLeft: "1rem",
          }}
          // disableTypography
          color="red"
        >
          <p style={{ color: "grey", fontSize: "14px" }}>
            {friend.lastInteraction}
          </p>
        </ListItemText>
      </ListItem>
      <Divider variant="inset" component="li" />
    </>
  );
};

export default ContactItem;
