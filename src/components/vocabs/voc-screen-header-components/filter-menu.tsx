import { MouseEvent, useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  Typography,
  FormControl,
  Switch,
  Select,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";

type Props = {};

const FilterMenu = (props: Props) => {
  // Filtern/Sortieren nach: Sprache, gelernt / ungelernt, Score von bis, neu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  return (
    <span>
      <IconButton
        edge="end"
        aria-label="options-menu"
        color="inherit"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <FilterListIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}
        >
          <Typography variant="body1">Only new Vocabs</Typography>
          <Switch />
        </MenuItem>
        <MenuItem
          sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}
        >
          <Typography variant="body1">Only unlearned Vocabs</Typography>
          <Switch />
        </MenuItem>
        <MenuItem>
          <Typography>Filter By</Typography>
          <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
            {/* <InputLabel id="demo-simple-select-standard-label">
                    Age
                  </InputLabel> */}
            <Select
              labelId="demo-simple-select-standard-label"
              id="demo-simple-select-standard"
              // value={notebookFilterSet.filterBy}
              onChange={(e) => {
                const val = e.target.value;
                // if (val === "language" || val === "none" || val === "sender")
                // dispatch(changeNoteFilter(val));
              }}
              label="Filter"
            >
              <MenuItem value={"none"}>None</MenuItem>
              <MenuItem value={"language"}>language</MenuItem>
              <MenuItem value={"sender"}>creater</MenuItem>
            </Select>
          </FormControl>
        </MenuItem>
        {/* {notebookFilterSet.filterBy === "language" && (
          <MenuItem>
            <Typography>Language</Typography>
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
              <Select
                labelId="filter-language-select-label"
                id="filter-language-select"
                value={
                  notebookFilterSet.language ? notebookFilterSet.language : ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  dispatch(changeNoteFiltLang(val));
                }}
                label="language"
              >
                {noteLangs.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </MenuItem>
        )} */}
      </Menu>
    </span>
  );
};

export default FilterMenu;
