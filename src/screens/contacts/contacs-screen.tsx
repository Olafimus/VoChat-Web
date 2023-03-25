import { Typography } from "@mui/material";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import React from "react";
import ContactsList from "../../components/contacts/contacts-list";
import AddDialog from "../../components/contacts/add-diologue";

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
          display: "grid",
          marginTop: "2rem",
          height: "80vh",
          gridTemplateRows: "20% 70% 10%",
        }}
      >
        <Typography variant="h6">Contacts</Typography>
        <div>
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

export default ContactScreen;
