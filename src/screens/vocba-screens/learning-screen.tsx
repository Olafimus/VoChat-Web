import React, { useState } from "react";
import { Box, Typography, Button, Grid } from "@mui/material";
import { useAppSelector } from "../../app/hooks";
import { useMediaQuery } from "@mui/material";

import StyledGridItem from "../../components/general/styled-grid-item";

export type RouteTypes =
  | "default"
  | "random"
  | "workbook"
  | "mistakes"
  | undefined;

const LearningScreen = () => {
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const [route, setRoute] = useState<RouteTypes>(undefined);
  const matches = useMediaQuery("(min-width:750px)");

  return (
    <Box>
      <Typography variant="h5">Choose your learning route!</Typography>
      <>
        <Grid
          mt={0}
          container
          spacing={3}
          direction="row"
          justifyContent="center"
          alignItems="center"
          columns={matches ? 2 : 1}
        >
          <StyledGridItem
            xs={2}
            text="Default Route!"
            link="/vocab/learning/default"
          />
          <StyledGridItem
            xs={2}
            text="Workbook"
            link="/vocab/learning/workbook"
          />
          <StyledGridItem
            xs={1}
            text="Some random Vocabs"
            link="/vocab/learning/random"
          />
          <StyledGridItem
            xs={1}
            text="Redeem yourself by learning your last mistakes!"
            link="/vocab/learning/mistakes"
          />
        </Grid>
      </>
    </Box>
  );
};

export default LearningScreen;
