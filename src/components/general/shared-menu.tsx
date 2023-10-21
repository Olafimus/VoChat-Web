import { Menu, MenuItem } from "@mui/material";
import { VocObj, WorkbookType } from "../../logic/types/vocab.types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { addMsgHis, createMsgObj } from "../chat/editable-input-div";
import { sendNewMessage, sendSharedWb } from "../../utils/firebase";
import { useNavigate } from "react-router-dom";
import { switchActiveConv } from "../../app/slices/conversation-slice";

const ShareMenu = ({
  open,
  anchorEl,
  setOpen,
  vocObj,
  wb,
  wbVocs,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  setOpen: (val: boolean) => void;
  vocObj?: VocObj;
  wb?: WorkbookType;
  wbVocs?: VocObj[];
}) => {
  const nav = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useAppSelector((state) => state.user);

  const handleSubmit = (convId: string) => {
    const msg = createMsgObj(id);

    if (vocObj) addMsgHis(msg, "", "vocab", vocObj);
    if (wb && wbVocs) {
      addMsgHis(msg, "", "wb", undefined, wb, wbVocs.length);
      sendSharedWb(wb.id, wbVocs);
    }

    sendNewMessage(convId, msg);
    setOpen(false);
    dispatch(switchActiveConv(convId));
    nav("/chat");
  };

  const handleClose = () => {
    setOpen(false);
  };
  const { friends } = useAppSelector((state) => state.user);

  return (
    <Menu
      id="basic-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      MenuListProps={{
        "aria-labelledby": "basic-button",
      }}
    >
      {friends.map((friend) => (
        <MenuItem
          key={friend.id}
          onClick={() => {
            handleSubmit(friend.conversation);
          }}
        >
          {friend.name}
        </MenuItem>
      ))}
    </Menu>
  );
};

export default ShareMenu;
