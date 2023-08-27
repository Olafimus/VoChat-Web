import React from "react";
import {
  Box,
  Avatar,
  Typography,
  Divider,
  Grid,
  FormControl,
  Stack,
  Paper,
  Tooltip,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import SectionPaper from "../../components/general/screen-elements/section-paper";
import LanguageConfiguration from "../../components/general/screen-elements/language-configuration";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Link } from "react-router-dom";
import { resetUserState } from "../../app/slices/user-slice";
import { resetConversations } from "../../app/slices/conversation-slice";

const ProfilePage = () => {
  const { name, email, joinedAt } = useAppSelector((state) => state.user);
  const matches = useMediaQuery("(min-width:600px)");
  const dispatch = useAppDispatch();

  let paperStyle = {
    p: "10px",
    border: "solid 2px",
    borderRadius: "10px",
    borderColor: "#78909c",
  };

  return (
    <Box
      height="100%"
      // position={matches ? "fixed" : "sticky"}
      width="100%"
      // maxWidth={700}
      sx={{ overflow: "hidden" }}
      my={2}
    >
      <Box display="flex" flexWrap="wrap" height="100%" gap="1rem">
        <section style={matches ? { width: 300 } : { width: "100%" }}>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap="0.3rem"
          >
            <Avatar sx={{ height: 100, width: 100 }} />
            <Typography variant="h6">{name}</Typography>
            <Typography variant="h6">{email}</Typography>
            <Divider sx={{ width: "100%" }} />
            <Tooltip title="work in progress (change name, pw etc)">
              <Typography
                variant="body1"
                sx={{ ":hover": { cursor: "pointer" } }}
              >
                Edit Profile
              </Typography>
            </Tooltip>
            <Link
              to="/login"
              onClick={() => {
                dispatch(resetUserState());
                dispatch(resetConversations());
              }}
            >
              <Typography
                variant="body1"
                color="red"
                sx={{ ":hover": { cursor: "pointer" } }}
              >
                Log-Out
              </Typography>
            </Link>
          </Box>
        </section>

        <section
          style={{
            minWidth: 300,
            overflow: "auto",
            height: "100%",
            flex: "1",
            paddingRight: "1rem",
          }}
        >
          <Typography variant="h5" mb={1} textAlign="center">
            Your Data
          </Typography>
          <Stack spacing={2}>
            <SectionPaper>
              <Typography variant="h6">Languge Configuration</Typography>
              <LanguageConfiguration type="profile" />
            </SectionPaper>

            <SectionPaper>
              <Typography variant="h6">Vocab Statistics</Typography>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                }}
              >
                <Grid container columns={4}>
                  <Grid item xs={3}>
                    Vocabs:
                  </Grid>
                  <Grid item xs={1}>
                    10
                  </Grid>
                </Grid>
                <Grid container columns={4}>
                  <Grid item xs={3}>
                    Workbooks:
                  </Grid>
                  <Grid item xs={1}>
                    3
                  </Grid>
                </Grid>
                <Grid container columns={4}>
                  <Grid item xs={3}>
                    Categories
                  </Grid>
                  <Grid item xs={1}>
                    4
                  </Grid>
                </Grid>
                <Grid container columns={4}>
                  <Grid item xs={3}>
                    Shared Vocabs
                  </Grid>
                  <Grid item xs={1}>
                    4
                  </Grid>
                </Grid>
                <Grid container columns={4}>
                  <Grid item xs={3}>
                    Shared Workbooks
                  </Grid>
                  <Grid item xs={1}>
                    4
                  </Grid>
                </Grid>
              </div>
            </SectionPaper>
            <SectionPaper>
              <Typography variant="h6">User Informations</Typography>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                }}
              >
                <Grid container columns={4}>
                  <Grid item xs={2}>
                    joined at:
                  </Grid>
                  <Grid item xs={2}>
                    {joinedAt?.toLocaleDateString()}
                  </Grid>
                </Grid>
              </div>
            </SectionPaper>
          </Stack>
        </section>
      </Box>
    </Box>
  );
};

export default ProfilePage;