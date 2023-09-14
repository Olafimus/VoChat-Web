import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { globalColors } from "../../assets/constants/colors";
import { useNavigate } from "react-router-dom";

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography p={2} variant="h3">
        Welcome to VocChat!
      </Typography>
      <Typography variant="h5">
        The Web-App, where you can get in touch with your friends and learn
        Languages together
      </Typography>
      <Typography variant="body1" p={2}>
        In order to get started you have to register an account or log in. To
        learn more about VocChat you can get it{" "}
        <span
          style={{ color: globalColors.blue }}
          className="pointer-cursor"
          onClick={() => navigate("/about")}
        >
          <b>here</b>
        </span>
      </Typography>
      <Box>
        <Typography variant="body1">Create an account</Typography>
        <Button onClick={() => navigate("/signup")} size="large">
          Register
        </Button>
        <Typography variant="body1">Already have an account?</Typography>
        <Button onClick={() => navigate("/login")}>Log In</Button>
      </Box>
    </Box>
  );
};

export default WelcomePage;
