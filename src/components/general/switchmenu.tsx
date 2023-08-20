import * as React from "react";
import { styled, alpha } from "@mui/material/styles";
import Button from "@mui/material/Button";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import EditIcon from "@mui/icons-material/Edit";
import Divider from "@mui/material/Divider";
import ArchiveIcon from "@mui/icons-material/Archive";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  VocSetIdentifier,
  changeVocBoolSetting,
} from "../../app/slices/settings-slice";

const StyledMenu = styled((props: MenuProps) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: "bottom",
      horizontal: "right",
    }}
    transformOrigin={{
      vertical: "top",
      horizontal: "right",
    }}
    {...props}
  />
))(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color:
      theme.palette.mode === "light"
        ? "rgb(55, 65, 81)"
        : theme.palette.grey[300],
    boxShadow:
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
    "& .MuiMenu-list": {
      padding: "4px 0",
    },
    "& .MuiMenuItem-root": {
      "& .MuiSvgIcon-root": {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1.5),
      },
      "&:active": {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity
        ),
      },
    },
  },
}));

const SwitchMenu = ({
  open,
  anchorEl,
  setAnchorEl,
  children,
}: {
  open: boolean;
  anchorEl: null | HTMLElement;
  setAnchorEl: (val: any) => void;
  children?: JSX.Element[];
}) => {
  const dispatch = useAppDispatch();
  const { vocabSubSettings } = useAppSelector((state) => state.settings);
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div>
      <StyledMenu
        id="demo-customized-menu"
        MenuListProps={{
          "aria-labelledby": "demo-customized-button",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {children}
        <MenuItem disableRipple>
          <Switch
            value="closeAfterAdd"
            name="Close after adding"
            checked={vocabSubSettings.closeAfterAdd}
            onChange={(e) =>
              dispatch(
                changeVocBoolSetting({
                  name: "closeAfterAdd",
                  value: e.currentTarget.checked,
                })
              )
            }
          />
          Close Dialog after adding a vocab
        </MenuItem>
        <MenuItem disableRipple>
          <Switch
            value={"closeAfterEdit"}
            name="Close after editing"
            checked={vocabSubSettings.closeAfterEdit}
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "closeAfterEdit",
                  value: e.currentTarget.checked,
                })
              );
            }}
          />
          Close Dialog after editing a vocab
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem disableRipple>
          <Switch
            value="needConfirmation"
            name="Require Confirmation for editing"
            checked={vocabSubSettings.needConfirmation}
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "needConfirmation",
                  value: e.currentTarget.checked,
                })
              );
            }}
          />
          Ask for confirmation by editing
        </MenuItem>{" "}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem disableRipple>
          <Switch
            name="Show Pronunciation"
            value="showPronunc"
            checked={vocabSubSettings.showPronunc}
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "showPronunc",
                  value: e.currentTarget.checked,
                })
              );
            }}
          />
          Show Pronunciation
        </MenuItem>
        <MenuItem disableRipple>
          <Switch
            value="showHints"
            checked={vocabSubSettings.showHints}
            name="Show Hints"
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "showHints",
                  value: e.currentTarget.checked,
                })
              );
            }}
          />
          Show Hints
        </MenuItem>{" "}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem disableRipple>
          <Switch
            value="showCat"
            checked={vocabSubSettings.showCat}
            name="Show Categories"
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "showCat",
                  value: e.currentTarget.checked,
                })
              );
            }}
          />
          Show Categories
        </MenuItem>
        <MenuItem disableRipple>
          <Switch
            value="shoWbs"
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "showWbs",
                  value: e.currentTarget.checked,
                })
              );
            }}
            checked={vocabSubSettings.showWbs}
            name="Show Workbooks"
          />
          Show Workbooks
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem disableRipple>
          <Switch
            value="keepWbs"
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "keepWbs",
                  value: e.currentTarget.checked,
                })
              );
            }}
            checked={vocabSubSettings.keepWbs}
            name="Keep Workbooks"
          />
          Keep Workbooks
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem disableRipple>
          <Switch
            value="keepCats"
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "keepCats",
                  value: e.currentTarget.checked,
                })
              );
            }}
            checked={vocabSubSettings.keepCats}
            name="Keep Categories"
          />
          Keep Categories
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem disableRipple>
          <Switch
            value="showImp"
            onChange={(e) => {
              dispatch(
                changeVocBoolSetting({
                  name: "showImp",
                  value: e.currentTarget.checked,
                })
              );
            }}
            checked={vocabSubSettings.showImp}
            name="Show Importance"
          />
          Show Importance
        </MenuItem>
      </StyledMenu>
    </div>
  );
};
export default SwitchMenu;
