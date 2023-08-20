import {
  Avatar,
  Divider,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import React from "react";
import { useNavigate } from "react-router-dom";
import { PropTypes } from "../../logic/types/proptypes";
import { Interweave } from "interweave";
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
import { nanoid } from "@reduxjs/toolkit";

const ContactItem: React.FC<PropTypes> = ({ friend }) => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  const { theme } = useAppSelector((state) => state.settings);

  let lastMsg = friend.lastMessage
    .replace("<span class='text-emoji'>", "")
    .replace('<span class="text-emoji">', "")
    .replace("</span>", "")
    .replace("&nbsp;", " ")
    .replace("</span>&nbsp", "");

  if (lastMsg.length > 60) {
    lastMsg = lastMsg.slice(0, 60) + "...";
  }

  const { activeContact, conversations } = useAppSelector(
    (state) => state.conversations
  );

  const time = getFormatedDate(friend.lastInteraction);

  const clickHandler = () => {
    if (!user) return;
    const id = nanoid();

    if (friend.conversation === "") {
      const conv: Conversation = {
        ...newConversation,
        users: [user.id, friend.id],
        id,
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
  let activeStyle = {
    backgroundColor: "rgb(30, 30, 30)",
    pointer: "cursor",
    justifyContent: "center",
  };
  if (theme === "light")
    activeStyle = {
      backgroundColor: "rgb(200, 200, 200)",
      pointer: "cursor",
      justifyContent: "center",
    };

  const StandardCard = () => (
    <>
      <ListItemAvatar>
        <Avatar alt="Remy Sharp" {...stringAvatar(friend.name ?? "")} />
      </ListItemAvatar>
      <ListItemText
        primary={friend.name}
        secondary={
          <React.Fragment>
            <Typography
              sx={{
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
              // component="span"
              variant="body2"
              color="text.primary"
              id={`previewText--${friend.id}`}
            >
              <Interweave content={lastMsg} />
            </Typography>
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
    </>
  );

  return (
    <>
      <ListItem
        alignItems="flex-start"
        sx={
          activeContact === friend.id
            ? activeStyle
            : {
                pointer: "cursor",
                justifyContent: "center",
              }
        }
        onClick={clickHandler}
      >
        <StandardCard />
      </ListItem>
      <Divider variant="inset" component="li" />
    </>
  );
};

export default ContactItem;
