import React from "react";
import { Typography, Button } from "@mui/material";

const PageNotFound = () => {
  return (
    <section>
      <Typography variant="h3">Page not found!</Typography>{" "}
      <Typography>
        Could not find this page, choose another route or{" "}
      </Typography>
      <Button>Go Back home</Button>
    </section>
  );
};

export default PageNotFound;
