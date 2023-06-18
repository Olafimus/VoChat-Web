import { Menu, MenuItem } from "@mui/material";
import { VocObj, workbookType } from "../../logic/types/vocab.types";
import { useAppSelector } from "../../app/hooks";
import { addMsgHis, createMsgObj } from "../chat/editable-input-div";
import { sendNewMessage, sendSharedWb } from "../../utils/firebase";

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
  wb?: workbookType;
  wbVocs?: VocObj[];
}) => {
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
