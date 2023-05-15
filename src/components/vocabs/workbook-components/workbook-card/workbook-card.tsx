import * as React from "react";
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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useAppDispatch, useAppSelector } from "../../../../app/hooks";
import {
  removeVocFromLS,
  removeWorkbook,
  updateVocabLS,
} from "../../../../app/slices/vocabs-slice";
import { workbookType } from "../../../../logic/types/vocab.types";
import ManageWorkbook from "../manage-workbook-dialog";

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

const WorkbookCard = ({ wb }: { wb: workbookType }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [openModal, setOpenModal] = React.useState(false);
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const dispatch = useAppDispatch();

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };
  const wbVocs = allVocabs.getWbVocs(wb.id);

  const moreInfo = [
    { title: "Score", info: wb.score },
    { title: "Vocab Count", info: wbVocs.length },
    { title: "Last learned", info: wb.lastLearned },
    { title: "Vocab-List", info: wbVocs.map((voc) => voc.getVocArr()[0]) },
    { title: "rel Cats", info: "vll related cats?" },
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
        <CardHeader
          title={wb.name}
          sx={{ mb: "0", pb: "0.2rem", pt: "0.3rem" }}
          // subheader={vocab.getVocabSliceString()}
        />

        <CardActions disableSpacing onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Share this workbook" arrow>
            <IconButton
              size="small"
              aria-label="share"
              onClick={(e) => e.stopPropagation()}
            >
              <ShareIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Manage workbook" arrow>
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
          <IconButton
            size="small"
            aria-label="delete"
            onClick={(e) => {
              e.stopPropagation();
              wbVocs.forEach((voc) => voc.removeWb(wb.id));
              wbVocs.forEach((voc) => dispatch(updateVocabLS(voc.getVocObj())));
              dispatch(removeWorkbook(wb));
            }}
          >
            <DeleteIcon />
          </IconButton>
          <Tooltip title="Add a new Vocab" arrow>
            <IconButton
              size="small"
              aria-label="add"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <AddRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="learn workbook" arrow>
            <IconButton
              size="small"
              aria-label="learn"
              onClick={(e) => e.stopPropagation()}
            >
              <SchoolRoundedIcon sx={{ color: green[600] }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            aria-label="delete"
            onClick={(e) => e.stopPropagation()}
          >
            <StarBorderPurple500Icon sx={{ color: yellow[700] }} />
          </IconButton>
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
      <ManageWorkbook
        wb={wb}
        keepMounted={false}
        open={openModal}
        onClose={() => setOpenModal(false)}
      />
    </>
  );
};

export default WorkbookCard;
