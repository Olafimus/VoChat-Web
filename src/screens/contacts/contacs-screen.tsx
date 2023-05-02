import { Typography, useMediaQuery } from "@mui/material";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import React from "react";
import ContactsList from "../../components/contacts/contacts-list";
import AddDialog from "../../components/contacts/add-diologue";
import { useAppSelector } from "../../app/hooks";

const ContactScreen = ({
  matches,
  type,
}: {
  matches: boolean;
  type: "small" | "big";
}) => {
  const [open, setOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState("");
  // const matches = useMediaQuery("(min-width:800px)");
  const { activeScreen } = useAppSelector((state) => state.settings);
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

  if (activeScreen === "contacts") return <Content />;

  return <>{matches && <Content />}</>;
};

export default ContactScreen;
