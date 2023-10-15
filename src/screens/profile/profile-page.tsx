import { useState } from "react";
import Push from "push.js";
import {
  Box,
  Avatar,
  Typography,
  Divider,
  Grid,
  Stack,
  Tooltip,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import SectionPaper from "../../components/general/screen-elements/section-paper";
import LanguageConfiguration from "../../components/general/screen-elements/language-configuration";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Link } from "react-router-dom";
import { resetUserState } from "../../app/slices/user-slice";
import { resetConversations } from "../../app/slices/conversation-slice";
import ProfileImageUpload from "../../components/profile/profile-image-upload";
import { resetVocabSlice } from "../../app/slices/vocabs-slice";
import { resetVocClassSlice } from "../../app/slices/vocabs-class-slice";
import { notifyUser } from "../../utils/notification";
import Logo from "../../assets/images/logo.svg";

const ProfilePage = () => {
  const [open, setOpen] = useState(false);
  const { name, email, joinedAt, imageURL } = useAppSelector(
    (state) => state.user
  );
  const user = useAppSelector((state) => state.user);
  const matches = useMediaQuery("(min-width:600px)");
  const dispatch = useAppDispatch();
  console.log(user);

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
            mt={2}
          >
            <span onClick={() => setOpen(true)}>
              <Avatar
                src={imageURL ? imageURL : ""}
                sx={{ height: 150, width: 150 }}
              />
            </span>
            <Typography variant="h6">{name}</Typography>
            <Typography variant="h6">{email}</Typography>
            <Divider sx={{ width: "100%" }} />
            <Tooltip title="work in progress (change name, pw etc)">
              <span>
                <Typography
                  variant="body1"
                  sx={{ ":hover": { cursor: "pointer" } }}
                >
                  Edit Profile
                </Typography>
              </span>
            </Tooltip>
            <Link
              to="/login"
              onClick={() => {
                dispatch(resetUserState());
                dispatch(resetConversations());
                dispatch(resetVocabSlice());
                dispatch(resetVocClassSlice());
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
            <span
              onClick={() =>
                Push.create("You have now activated Notifications", {
                  body: "send from VocChat",
                  icon: Logo,
                })
              }
            >
              <Typography
                variant="body1"
                color="primary"
                sx={{ ":hover": { cursor: "pointer" } }}
              >
                Allow Notifications
              </Typography>
            </span>
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
      {open && <ProfileImageUpload open={open} setOpen={setOpen} />}
    </Box>
  );
};

export default ProfilePage;
