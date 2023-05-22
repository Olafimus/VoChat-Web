import * as React from "react";
import "./vocab-card.styles.scss";
import { styled } from "@mui/material/styles";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Collapse from "@mui/material/Collapse";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { red, green, yellow } from "@mui/material/colors";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ShareIcon from "@mui/icons-material/Share";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StarBorderPurple500Icon from "@mui/icons-material/StarBorderPurple500";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import { Vocab } from "../../../logic/classes/vocab.class";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { removeVocFromLS, setVocabs } from "../../../app/slices/vocabs-slice";
import AddVocab from "../add-vocab";
import { Menu, MenuItem } from "@mui/material";
import { addMsgHis, createMsgObj } from "../../chat/editable-input-div";
import { VocObj } from "../../../logic/types/vocab.types";
import { sendNewMessage } from "../../../utils/firebase";

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

const ShareMenu = ({
  open,
  anchorEl,
  setOpen,
  vocObj,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  setOpen: (val: boolean) => void;
  vocObj: VocObj;
}) => {
  const { id } = useAppSelector((state) => state.user);

  const handleSubmit = (convId: string) => {
    const msg = createMsgObj(id);
    addMsgHis(msg, "", "vocab", vocObj);
    console.log(msg);
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

const VocabCard = ({ vocab }: { vocab: Vocab }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [openModal, setOpenModal] = React.useState(false);
  const [openShareMenu, setOpenShareMenu] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const dispatch = useAppDispatch();

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const moreInfo = [
    { title: "Score", info: vocab.getScore() },
    { title: "Workbooks", info: vocab.getWorkbooksStr() },
    { title: "Categories", info: vocab.getCategoriesStr() },
    { title: "Hints", info: vocab.getHintsStr() },
    // title: "learnHis", info: },
  ];

  return (
    <>
      <Card
        sx={{ maxWidth: 500 }}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <span
          className="card-header-wrapper"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <CardHeader
            title={vocab.getVocArr()[0]}
            subheader={vocab.getVocabSliceString()}
          />
          <CardHeader
            title={vocab.getTranslArr()[0]}
            subheader={vocab.getTranslSliceString()}
          />
        </span>

        <CardActions disableSpacing onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Share Vocab" arrow>
            <IconButton
              size="small"
              aria-label="share"
              // ref={anchorEl}
              onClick={(e) => {
                setAnchorEl(e.currentTarget);
                e.stopPropagation();
                setOpenShareMenu(true);
              }}
            >
              <ShareIcon />
            </IconButton>
          </Tooltip>
          <ShareMenu
            open={openShareMenu}
            setOpen={setOpenShareMenu}
            anchorEl={anchorEl}
            vocObj={vocab.getVocObj()}
          />
          <Tooltip title="Edit Vocab" arrow>
            <IconButton
              size="small"
              aria-label="edit"
              onClick={(e) => {
                e.stopPropagation();
                setOpenModal(true);
              }}
            >
              <EditIcon sx={{ color: yellow[700] }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Vocab" arrow>
            <IconButton
              size="small"
              aria-label="delete"
              onClick={(e) => {
                e.stopPropagation();
                allVocabs.removeVoc(vocab.getId());
                dispatch(removeVocFromLS(vocab.getId()));
              }}
            >
              <DeleteIcon sx={{ color: red[600] }} />
            </IconButton>
          </Tooltip>
          {/* <Tooltip title="learn" arrow>
            <IconButton
              size="small"
              aria-label="delete"
              onClick={(e) => e.stopPropagation()}
            >
              <SchoolRoundedIcon sx={{ color: green[600] }} />
            </IconButton>
          </Tooltip> */}
          {/* <IconButton
            size="small"
            aria-label="delete"
            onClick={(e) => e.stopPropagation()}
          >
            <StarBorderPurple500Icon sx={{ color: yellow[700] }} />
          </IconButton> */}
          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </CardActions>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <CardContent>
            {moreInfo.map((info) => (
              <span key={info.title} className="vocab-card-information-item">
                <Typography>{info.title}</Typography>
                <Divider orientation="vertical" />
                <Typography textAlign="right">{info.info}</Typography>
              </span>
            ))}
          </CardContent>
        </Collapse>
      </Card>
      <AddVocab
        setOpen={setOpenModal}
        open={openModal}
        type="edit"
        vocab={vocab}
        {...vocab.getEditProps()}
      />
    </>
  );
};

export default VocabCard;
