import * as React from "react";
import AppBar from "@mui/material/AppBar";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import { Tooltip } from "@mui/material";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import MoreIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import Fab from "@mui/material/Fab";
import FilterListIcon from "@mui/icons-material/FilterList";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CategoryIcon from "@mui/icons-material/Category";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Pagination from "@mui/material/Pagination";
import { useAppSelector } from "../../app/hooks";

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

const CategoriesMenu = () => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const matches = true;
  return (
    <span>
      {!matches ? (
        <IconButton
          aria-label="options-menu"
          color="inherit"
          aria-controls={open ? "basic-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={handleClick}
        >
          <CategoryIcon />
        </IconButton>
      ) : (
        <span onClick={handleClick}>
          <Box
            display="flex"
            // border="1px solid black"
            borderRadius={2}
            sx={{
              "&:hover": {
                color: "red",
                backgroundColor: "white",
              },
            }}
          >
            <Typography sx={{ pl: 1 }}>Categories</Typography>
            <ExpandMoreIcon />
          </Box>
        </span>
      )}

      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <TextField
          size="small"
          label="Search"
          sx={{ m: "5px", position: "sticky" }}
        />
        <MenuItem onClick={handleClose}>Name</MenuItem>
        <MenuItem onClick={handleClose}>My account</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
      </Menu>
    </span>
  );
};

const OptionsMenu = () => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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
        <MoreIcon />
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
        <MenuItem onClick={handleClose}>Profile</MenuItem>
        <MenuItem onClick={handleClose}>My account</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
      </Menu>
    </span>
  );
};

const FilterMenu = () => {
  // Filtern/Sortieren nach: Sprache, gelernt / ungelernt, Score von bis, neu
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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
        <MenuItem onClick={handleClose}>Profile</MenuItem>
        <MenuItem onClick={handleClose}>My account</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
      </Menu>
    </span>
  );
};

const VocHeader = () => {
  const { theme } = useAppSelector((state) => state.settings);
  let matches = true;
  const flag = "\ud83c\uddee\ud83c\uddf3";
  let vocabType = "Your Vocabs"; // Je nachdem was gezeigt wird
  const bgcolor = theme === "dark" ? "blue" : "#81d4fa";
  return (
    <Box bgcolor={bgcolor} sx={{ flexGrow: 1, borderRadius: 2 }}>
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

        <StyledFab color="primary" aria-label="add">
          <AddIcon />
        </StyledFab>
        <Box sx={{ flexGrow: 1 }} />
        {!matches ? (
          <input />
        ) : (
          <IconButton aria-label="search-menu" color="inherit">
            <SearchIcon />
          </IconButton>
        )}
        <Tooltip arrow title="Filter Categories">
          <CategoriesMenu />
        </Tooltip>
        <Tooltip arrow title="Set Filters">
          <FilterMenu />
        </Tooltip>
        <Tooltip arrow title="Show options">
          <OptionsMenu />
        </Tooltip>
      </Toolbar>
    </Box>
  );
};

export default VocHeader;
