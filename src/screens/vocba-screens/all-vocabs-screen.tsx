import React, { useState, memo } from "react";
import AddVocab from "../../components/vocabs/add-vocab";
import VocabCardList from "../../components/vocabs/vocab-card-components/all-vocabs-list";
import { Box, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchField from "../../components/general/search-field";
import { useAppSelector } from "../../app/hooks";
import { Button } from "@mui/material";

const AllVocabs = () => {
  const [searchString, setSearchString] = useState("");
  const [open, setOpen] = useState(false);
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const [render, setRender] = useState(false);
  // let check = allVocabs.getAllVocs.length > 0;

  // useEffec;

  return (
    <Box minHeight="70dvh">
      <Typography variant="h5">AllVocabs</Typography>
      <Box display="flex" flexDirection="row" justifyContent="center" mb={2}>
        <SearchField setSearchTerm={setSearchString} />
        <Button
          sx={{ mx: 1 }}
          size="large"
          onClick={() => setOpen(!open)}
          endIcon={<AddIcon />}
        >
          Add
        </Button>
      </Box>
      <AddVocab
        open={open}
        setOpen={setOpen}
        render={render}
        setRender={setRender}
      />

      <VocabCardList
        allVocs={allVocabs}
        render={render}
        searchString={searchString}
      />
    </Box>
  );
};

export default AllVocabs;
