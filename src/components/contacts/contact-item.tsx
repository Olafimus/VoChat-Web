import {
  Avatar,
  Divider,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PropTypes } from "../../logic/types/proptypes";

import { addConvToFriend, setConvDoc } from "../../utils/firebase";
import {
  Conversation,
  newConversation,
} from "../../logic/classes/conversation.class";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  switchActiveContact,
  switchActiveConv,
} from "../../app/slices/conversation-slice";
import { addConvRef, addConvToFriendUser } from "../../app/slices/user-slice";
import { switchScreen } from "../../app/slices/settings-slice";
import { getFormatedDate } from "../../utils/getFormDate";

const ContactItem: React.FC<PropTypes> = ({ friend }) => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();

  const { activeContact, conversations } = useAppSelector(
    (state) => state.conversations
  );

  const time = getFormatedDate(friend.lastInteraction);

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
    dispatch(switchActiveContact(friend.id));
    dispatch(switchScreen("chat"));

    // dispatch(countUnreadMsgs());
    navigate("/chat", { replace: false });
  };

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
        sx={
          activeContact === friend.id
            ? {
                cursor: "pointer",
                backgroundColor: "rgb(30, 30, 30)",
              }
            : { cursor: "pointer" }
        }
        onClick={clickHandler}
      >
        <ListItemAvatar>
          <Avatar alt="Remy Sharp" {...stringAvatar(friend.name ?? "")} />
        </ListItemAvatar>
        <ListItemText
          primary={friend.name}
          secondary={
            <React.Fragment>
              <Typography
                sx={{ display: "inline" }}
                component="span"
                variant="body2"
                color="text.primary"
              >
                {friend.lastMessage}
              </Typography>
              {/* {`${friend.lastMessage}`} */}
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
          <p style={{ color: "grey", fontSize: "14px" }}>{time}</p>
        </ListItemText>
      </ListItem>
      <Divider variant="inset" component="li" />
    </>
  );
};

export default ContactItem;
