import * as React from "react";
import { Box, Typography } from "@mui/material";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { Vocab } from "../../logic/classes/vocab.class";

function renderRow({
  props,
  vocabs,
  clickHandler,
}: {
  props: ListChildComponentProps;
  vocabs: Vocab[];
  clickHandler: (voc: Vocab) => void;
}) {
  const { index, style, data } = props;

  return (
    <ListItem
      style={{ ...style, width: "100%" }}
      key={index}
      component="div"
      disablePadding
    >
      <ListItemButton
        sx={{ justifyContent: "center" }}
        onClick={() => clickHandler(vocabs[index])}
      >
        <Typography noWrap textAlign="center">
          {vocabs[index].getVocabString()}
        </Typography>
      </ListItemButton>
    </ListItem>
  );
}

export default function VirtualizedList({
  vocabs,
  clickHandler,
}: {
  vocabs: Vocab[];
  clickHandler: (voc: Vocab) => void;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        // height: "50vh",
        maxWidth: 360,
        bgcolor: "background.paper",
      }}
    >
      <FixedSizeList
        height={390}
        width={360}
        itemSize={46}
        itemCount={vocabs.length}
        overscanCount={5}
        style={{ width: "100%" }}
      >
        {(props) => renderRow({ props, vocabs, clickHandler })}
      </FixedSizeList>
    </Box>
  );
}
