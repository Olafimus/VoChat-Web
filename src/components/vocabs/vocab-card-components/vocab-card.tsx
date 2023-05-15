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

const VocabCard = ({ vocab }: { vocab: Vocab }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [openModal, setOpenModal] = React.useState(false);
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
          {/* <IconButton
        size="small"
          aria-label="add to favorites"
          onClick={(e) => e.stopPropagation()}
        >
          <FavoriteIcon sx={{ color: red[500] }} />
        </IconButton> */}
          <IconButton
            size="small"
            aria-label="share"
            onClick={(e) => e.stopPropagation()}
          >
            <ShareIcon />
          </IconButton>
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
          <IconButton
            size="small"
            aria-label="delete"
            onClick={(e) => {
              e.stopPropagation();
              allVocabs.removeVoc(vocab.getId());
              dispatch(removeVocFromLS(vocab.getId()));
            }}
          >
            <DeleteIcon />
          </IconButton>
          <Tooltip title="learn" arrow>
            <IconButton
              size="small"
              aria-label="delete"
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
