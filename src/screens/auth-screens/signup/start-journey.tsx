import React, { useState } from "react";
import { Box, Grid, Typography } from "@mui/material";
import HomeScreen from "../../home/home-screen";
import StyledGridItem from "../../../components/general/styled-grid-item";

export default function StartJourney() {
  return (
    <Box>
      <Typography variant="h5">
        You successfully created your Account!
      </Typography>
      <Typography>
        You can start by adding Vocabs or searching a friend to start a
        conversation!
      </Typography>
      <Grid
        mt={0}
        container
        spacing={3}
        direction="row"
        justifyContent="center"
        alignItems="center"
        columns={2}
      >
        <StyledGridItem xs={2} text="Chat with your Friends!" link="/chat" />
        <StyledGridItem xs={2} text="Start adding Vocabs!" link="/vocab" />
        {/* <StyledGridItem
          xs={1}
          text="Start a learning session!"
          // link="/learning"
        />
        <StyledGridItem
          xs={1}
          text="Take a look at your Workbooks!"
          // link="/workbooks"
        /> */}
      </Grid>
    </Box>
  );
}
