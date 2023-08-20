import { MouseEvent, useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  TextField,
  Checkbox,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { changeVocCatFilter } from "../../../app/slices/settings-slice";

type Props = {};

const CategoriesMenu = ({
  matches,
  theme,
}: {
  matches: boolean;
  theme: string;
}) => {
  const dispatch = useAppDispatch();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const { categories } = useAppSelector((state) => state.vocabs);
  const { dataCategories, dbLang } = useAppSelector((state) => state.allVocabs);
  const backgroundColor = theme === "light" ? "white" : "#5c6bc0";
  // const color =
  const filCats = dbLang ? dataCategories : categories;
  const [checkedCats, setCheckedCats] = useState<string[]>([]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
    dispatch(changeVocCatFilter(checkedCats));
  };

  return (
    <>
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
            py={1}
            px={0.5}
            borderRadius={2}
            sx={{
              "&:hover": {
                backgroundColor,
                cursor: "pointer",
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
        {filCats.length > 0 ? (
          <span>
            {/* <TextField
              size="small"
              label="Search"
              sx={{ m: "5px", position: "sticky" }}
              onChange={(e) => e.preventDefault()}
            /> */}
            <MenuItem
              sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}
            >
              <Typography variant="body1">Show All</Typography>
              <Checkbox
                checked={checkedCats.length === 0}
                onChange={(e) => {
                  const check = e.currentTarget.checked;
                  if (check) setCheckedCats([]);
                }}
              />
            </MenuItem>
          </span>
        ) : (
          <MenuItem>No Vocabs with Categories yet!</MenuItem>
        )}
        {filCats.map((cat) => (
          <MenuItem
            key={cat}
            sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}
          >
            <Typography variant="body1">{cat}</Typography>
            <Checkbox
              checked={checkedCats.includes(cat)}
              onClick={(e) => {
                const check = checkedCats.includes(cat);
                if (!check) {
                  setCheckedCats((cur) => [...cur, cat]);
                } else setCheckedCats((cur) => cur.filter((el) => el !== cat));
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default CategoriesMenu;
