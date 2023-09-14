import { useState, useEffect } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { loadPreVocs } from "../../../utils/firebase/firebase-vocab";
import { AllVocabsClass, Vocab } from "../../../logic/classes/vocab.class";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import StorageIcon from "@mui/icons-material/Storage";
import "./overlay.scss";
import { useAppSelector } from "../../../app/hooks";
import { dbLangObj } from "../../../assets/constants/db-lang-obj";
import { useDbVocs } from "../../../utils/hooks/useDbVocs";

const DbLangMenu = ({
  matches,
  theme,
}: {
  matches: boolean;
  theme: string;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const openDbMen = Boolean(anchorEl);
  const handleClick = (
    event:
      | React.MouseEvent<HTMLDivElement, MouseEvent>
      | React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  const [setDbLang, setDataVocs] = useDbVocs(handleClose);
  const languages = Object.keys(dbLangObj) as Array<keyof typeof dbLangObj>;

  const backgroundColor = theme === "light" ? "white" : "#5c6bc0";

  return (
    <>
      {!matches ? (
        <Tooltip title="Select Database Vocabs" disableInteractive arrow>
          <IconButton
            aria-label="options-menu"
            color="inherit"
            aria-controls={openDbMen ? "basic-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={openDbMen ? "true" : undefined}
            onClick={(e) => handleClick(e)}
          >
            <StorageIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Box
          display="flex"
          py={1}
          px={0.5}
          borderRadius={2}
          component="div"
          onClick={(e) => handleClick(e)}
          sx={{
            "&:hover": {
              backgroundColor,
              cursor: "pointer",
            },
          }}
        >
          <Typography sx={{ pl: 1 }}>DB Vocs</Typography>
          <ExpandMoreIcon />
        </Box>
      )}
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={openDbMen}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          divider
          onClick={() => {
            setDataVocs(null);
            setDbLang(null);
            handleClose();
          }}
        >
          None
        </MenuItem>
        <MenuItem divider>
          <Typography>3000 most common words</Typography>
        </MenuItem>
        {languages.map((lang, i) => (
          <MenuItem
            key={lang}
            sx={{ display: "flex", justifyContent: "space-between" }}
            onClick={() => {
              setDbLang(lang);
              handleClose();
            }}
            divider={i === languages.length - 1 ? true : false}
          >
            <Typography sx={{ pr: 2 }}>{lang}</Typography>

            <img
              src={dbLangObj[lang].src}
              srcSet={dbLangObj[lang].srcset}
              width="16"
              height="12"
              alt={`${lang} Flag`}
            ></img>
          </MenuItem>
        ))}
        <MenuItem divider sx={{ display: "flex", justifyContent: "center" }}>
          Dictionaries
        </MenuItem>
        <MenuItem
          sx={{ display: "flex", justifyContent: "space-between" }}
          onClick={() => {
            setDbLang("FarsiDic");
            handleClose();
          }}
        >
          <Typography sx={{ pr: 2 }}>Farsi</Typography>

          <img
            src={dbLangObj["Farsi"].src}
            srcSet={dbLangObj["Farsi"].srcset}
            width="16"
            height="12"
            alt="Farsi Flag"
          ></img>
        </MenuItem>
      </Menu>
    </>
  );
};

export default DbLangMenu;
