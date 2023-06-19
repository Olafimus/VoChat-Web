import {
  Box,
  Collapse,
  ListItem,
  IconButton,
  Typography,
  Divider,
  Tooltip,
} from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import React, { Fragment } from "react";
import { Vocab } from "../../../logic/classes/vocab.class";

const VocabListView = ({
  vocab,
  type,
}: {
  vocab: Vocab;
  type?: "send" | "own";
}) => {
  const [open, setOpen] = React.useState(false);
  const moreInfo = [
    // { title: "Score", info: vocab.getScore() },
    // { title: "Workbooks", info: vocab.getWorkbooksStr() },
    { title: "Categories", info: vocab.getCategoriesStr() },
    { title: "Hints", info: vocab.getHintsStr() },
    // title: "learnHis", info: },
  ];
  const additionalInfo = [
    { title: "Pronunciations", info: vocab.getPronuncStr() },
  ];

  const infos = [...moreInfo, ...additionalInfo];

  return (
    <Fragment>
      <ListItem sx={{ flexDirection: "column" }}>
        <Box display="flex" flex={1} width="100%">
          <Box
            flex={1}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setOpen((cur) => !cur)}
          >
            <Typography>{vocab.getVocabString()}</Typography>
            <Typography>{vocab.getTranslString()}</Typography>
          </Box>
          {type === "send" && (
            <Tooltip title="Add just this Vocab" arrow>
              <IconButton size="small">+</IconButton>
            </Tooltip>
          )}
          <IconButton
            size="small"
            edge="end"
            aria-label="expand"
            onClick={() => setOpen((cur) => !cur)}
          >
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Collapse in={open} timeout="auto" unmountOnExit>
          {infos.map((info) => (
            <span key={info.title} className="vocab-card-information-item">
              <Typography>{info.title}</Typography>
              <Divider orientation="vertical" />
              <Typography textAlign="right">{info.info}</Typography>
            </span>
          ))}
        </Collapse>
      </ListItem>
    </Fragment>
  );
};

export default VocabListView;
