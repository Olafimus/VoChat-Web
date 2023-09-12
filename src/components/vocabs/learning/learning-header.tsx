import { useState, MouseEvent, Dispatch } from "react";
import AppBar from "@mui/material/AppBar";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import {
  Button,
  Fade,
  Paper,
  Popper,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Vocab } from "../../../logic/classes/vocab.class";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { firstToUpper } from "../../../utils/text-scripts/firstToUpper";
import { useNavigate } from "react-router-dom";
import { resetLearnSlice } from "../../../app/slices/learning-slice";
import { globalColors } from "../../../assets/constants/colors";

type HeaderProps = {
  theme: string;
  // vocabs: Vocab[];
  // filteredVocabs: Vocab[];
  // finished: boolean;
  // setFinished: (val: boolean) => void;
  // completed: boolean;
  // setCompleted: (val: boolean) => void;
};

const LearnHeader = ({ theme }: HeaderProps) => {
  const {
    round,
    route,
    roundFinished,
    completed,
    currentVocabs,
    checkedCount,
    currentResults,
    vocabs,
  } = useAppSelector((s) => s.learning);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // const [open, setOpen] = useState(false);
  // const [render, setRender] = useState(false);
  // const dispatch = useAppDispatch();
  // const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  // const [openPop, setOpenPop] = useState(false);

  // const matches = useMediaQuery("(min-width:1000px)");
  // const matches2 = useMediaQuery("(min-width:850px)");
  const matches3 = useMediaQuery("(min-width:600px)");
  const bgcolor = theme === "dark" ? "#3f51b5" : "#81d4fa";
  const rightAnswers = currentResults.reduce((acc, cur) => {
    if (cur === true) return acc + 1;
    else return acc;
  }, 0);
  const wrongAnswers = checkedCount - rightAnswers;
  const rightSide = (
    <>
      <IconButton
        size="small"
        sx={{ height: 25, width: 25, color: "inherit" }}
        onClick={() => {
          dispatch(resetLearnSlice());
          navigate("/vocab/learning");
        }}
      >
        <MoreVertIcon />
      </IconButton>
    </>
  );
  const mt = matches3 ? 8.05 : 7.05;

  return (
    <>
      <AppBar sx={{ mt, pl: 7, marginLeft: 10 }}>
        <Box bgcolor={bgcolor} position="sticky" py={0.5} sx={{ flexGrow: 1 }}>
          <Toolbar variant="dense">
            <Typography
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "50%",
              }}
              variant="body1"
              color="inherit"
              fontWeight="bold"
              component="div"
            >
              {route && firstToUpper(route as string)} learning
            </Typography>
            <Box sx={{ flexGrow: 1 }} />

            <Box display="flex" flexDirection="row" gap="0.5em">
              {" "}
              <Tooltip
                title={"Learning status"}
                // placement="top"
                disableInteractive
                arrow
              >
                <Typography
                  variant="body1"
                  fontWeight="bold"
                  color="inherit"
                  component="div"
                >
                  {checkedCount} / {currentVocabs.length} answered
                </Typography>
              </Tooltip>
              <Tooltip title="right / wrong" disableInteractive arrow>
                <Box display="flex" flexDirection="row">
                  <Typography
                    variant="body1"
                    color="inherit"
                    component="div"
                    fontWeight="bold"
                  >
                    <span style={{ color: globalColors.successGreen }}>
                      {rightAnswers}
                    </span>{" "}
                    /{" "}
                    <span style={{ color: globalColors.errorRed }}>
                      {wrongAnswers}
                    </span>{" "}
                    {currentResults.length > 0 &&
                      (rightAnswers / currentResults.length) * 100 + " %"}
                  </Typography>
                </Box>
              </Tooltip>
              {/* <Typography
                  px={0.4}
                  variant="body1"
                  color="inherit"
                  component="div"
                >
                  <span style={{ color: globalColors.successGreen }}>
                    right
                  </span>{" "}
                  / <span style={{ color: globalColors.errorRed }}>wrong</span>
                </Typography> */}
            </Box>

            <Box sx={{ flexGrow: 1 }} />
            {rightSide}
          </Toolbar>
        </Box>
      </AppBar>
      {/* <Popper open={openPop} anchorEl={anchorEl} placement="bottom" transition>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Paper>
              <Typography sx={{ p: 2 }}>
                Want to add all these Vocabs to your Vocabs?
              </Typography>
              <Box display="flex" justifyContent="space-around" mb={2} p={1}>
                <Button variant="outlined" onClick={() => setOpenPop(false)}>
                  No
                </Button>
                <Button variant="contained" onClick={addAll}>
                  Yes
                </Button>
              </Box>
            </Paper>
          </Fade>
        )}
      </Popper> */}
    </>
  );
};

export default LearnHeader;
