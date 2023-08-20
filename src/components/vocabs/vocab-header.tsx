import { useState, MouseEvent, Dispatch } from "react";
import AppBar from "@mui/material/AppBar";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import { Tooltip, useMediaQuery } from "@mui/material";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import Fab from "@mui/material/Fab";
import AddVocab from "./add-vocab";
import SearchField from "../general/search-field";
import FilterMenu from "./voc-screen-header-components/filter-menu";
import OptionsMenu from "./voc-screen-header-components/options-menu";
import CategoriesMenu from "./voc-screen-header-components/categories-menu";
import { useAppSelector } from "../../app/hooks";
import DbLangMenu from "./voc-screen-header-components/db-lang-menu";

const StyledFab = styled(Fab)({
  position: "absolute",
  zIndex: 1,
  top: 28,
  left: 0,
  right: 0,
  margin: "0 auto",
  width: "2.7em",
  height: "2.7em",
});

type HeaderProps = {
  // dbLang: string | null;
  setSearchString: Dispatch<React.SetStateAction<string>>;
  theme: string;
  searchString: string;
};

const VocHeader = ({
  theme,
  // dbLang,
  setSearchString,
  searchString,
}: HeaderProps) => {
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  const dbLang = useAppSelector((state) => state.allVocabs.dbLang);

  const matches = useMediaQuery("(min-width:1000px)");
  const matches2 = useMediaQuery("(min-width:850px)");
  const matches3 = useMediaQuery("(min-width:600px)");
  let vocabType = dbLang ? `${dbLang} Database Vocabs` : "Your Vocabs"; // Je nachdem was gezeigt wird
  const bgcolor = theme === "dark" ? "#3f51b5" : "#81d4fa";

  const onBlur = () => {
    if (searchString === "") setSearchActive(false);
  };

  const rightSide = (
    <>
      {matches2 ? (
        <SearchField setSearchTerm={setSearchString} />
      ) : (
        <>
          <IconButton
            aria-label="search-menu"
            color="inherit"
            onClick={() => {
              setSearchActive(true);
            }}
          >
            <SearchIcon />
          </IconButton>
        </>
      )}
      <CategoriesMenu theme={theme} matches={matches} />
      {!dbLang && <FilterMenu />}
      <DbLangMenu theme={theme} matches={matches} />
      <OptionsMenu />
    </>
  );

  const mt = matches3 ? 8.05 : 7.05;

  return (
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
            variant="h6"
            color="inherit"
            component="div"
          >
            {vocabType}
          </Typography>

          {!searchActive && (
            <Tooltip
              title={dbLang ? "Add all to your Vocabs" : "Add a Vocab"}
              placement="top"
              disableInteractive
              arrow
            >
              <StyledFab
                color={dbLang ? "success" : "primary"}
                aria-label="add"
                onClick={() => setOpen(!open)}
              >
                <AddIcon />
              </StyledFab>
            </Tooltip>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {searchActive ? (
            <SearchField
              focus={true}
              onBlur={onBlur}
              setSearchTerm={setSearchString}
            />
          ) : (
            rightSide
          )}
        </Toolbar>
        {!dbLang && (
          <AddVocab
            open={open}
            setOpen={setOpen}
            render={render}
            setRender={setRender}
          />
        )}
      </Box>
    </AppBar>
  );
};

export default VocHeader;
