import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import BotIcon from "../../assets/images/bot-Icon.jpg";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import React from "react";
import ContactsList from "../../components/contacts/contacts-list";
import AddDialog from "../../components/contacts/add-diologue";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  chatBot,
  setChatBotActive,
  switchActiveConv,
} from "../../app/slices/conversation-slice";

const ContactScreen = ({ matches }: { matches: boolean }) => {
  const [open, setOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState("");
  const dispatch = useAppDispatch();
  const { chatBotActive } = useAppSelector((state) => state.conversations);
  const { activeScreen } = useAppSelector((state) => state.settings);
  const { friends } = useAppSelector((state) => state.user);
  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = (value: string) => {
    setOpen(false);
    setSelectedValue(value);
  };

  const Content = () => {
    return (
      <>
        <div
          className="contacts-container"
          style={{
            display: "grid",
            // maxHeight: "70dvh",
            marginTop: "0rem",
            gridTemplateRows: "2.8rem 90% 10%",
            width: "100%",
            // overflow: "auto",
          }}
        >
          {" "}
          <Box display="flex" flexDirection="row">
            <Typography color="primary" flex={1} p={1} variant="h5">
              Contacts
            </Typography>
            <Tooltip
              title={
                chatBotActive ? "Leave Chatbot" : "Get Help from the Chat Bot"
              }
              arrow
            >
              <IconButton
                className={
                  !chatBotActive && friends.length === 0 ? "attention" : ""
                }
                size="small"
                sx={{ height: 30, width: 30, m: "auto" }}
                color={chatBotActive ? "warning" : "info"}
                onClick={() => {
                  const conv = chatBotActive ? "" : chatBot.conversation;
                  dispatch(setChatBotActive(!chatBotActive));
                  dispatch(switchActiveConv(conv));
                }}
              >
                <SmartToyIcon sx={{ height: 25, width: 25 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <div style={{ maxWidth: "100%", overflow: "hidden" }}>
            <ContactsList />
          </div>
          <div className="flex-container">
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
        </div>
        <AddDialog
          selectedValue={selectedValue}
          open={open}
          onClose={handleClose}
        />
      </>
    );
  };

  if (activeScreen === "contacts") return <Content />;

  return <>{matches && <Content />}</>;
};

export default ContactScreen;
