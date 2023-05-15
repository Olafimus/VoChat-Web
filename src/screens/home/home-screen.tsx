import { Box, Grid, Typography, Paper, Divider } from "@mui/material";
import "./homescreen.styles.scss";
import { styled } from "@mui/material/styles";
import * as React from "react";
import StyledGridItem from "../../components/general/styled-grid-item";

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
  height: 100,
}));

const HomeScreen = () => {
  return (
    <Box>
      <span
        className="home-title-wrapper"
        style={{ display: "flex", marginBottom: "0.5rem" }}
      >
        <span style={{ flex: 1 }}>
          <Typography variant="h4" textAlign="center" m={0} p={0}>
            VocChat
          </Typography>
          <Typography
            variant="body1"
            textAlign="center"
            m={0}
            p={0}
            style={{ display: "block" }}
          >
            Learning by Typing
          </Typography>
        </span>
      </span>
      <Divider />
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
        <StyledGridItem xs={2} text="Browse your Vocabularies!" link="/vocab" />
        <StyledGridItem
          xs={1}
          text="Start a learning session!"
          // link="/learning"
        />
        <StyledGridItem
          xs={1}
          text="Take a look at your Workbooks!"
          // link="/workbooks"
        />
      </Grid>
    </Box>
  );
};

export default HomeScreen;
