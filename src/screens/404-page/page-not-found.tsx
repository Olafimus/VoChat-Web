import React from "react";
import { Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const PageNotFound = () => {
  const nav = useNavigate();
  return (
    <section>
      <Typography variant="h3">Page not found!</Typography>{" "}
      <Typography>
        Could not find this page, choose another route or{" "}
      </Typography>
      <Button onClick={() => nav("/")}>Go Back home</Button>
    </section>
  );
};

export default PageNotFound;
