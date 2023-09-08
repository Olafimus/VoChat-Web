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
              component="div"
            >
              {route && firstToUpper(route as string)} learning
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip
              title={"Learning status"}
              placement="top"
              disableInteractive
              arrow
            >
              <Typography variant="body1" color="inherit" component="div">
                {checkedCount} / {currentVocabs.length} finished
              </Typography>
            </Tooltip>

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
