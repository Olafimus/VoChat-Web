import React, { useState, memo } from "react";
import AddVocab from "../../components/vocabs/add-vocab";
import VocabCardList from "../../components/vocabs/vocab-card-components/all-vocabs-list";
import Box from "@mui/material/Box";
import SearchField from "../../components/general/search-field";
import { useAppSelector } from "../../app/hooks";
import { Button } from "@mui/material";

const AllVocabs = () => {
  const [searchString, setSearchString] = useState("");
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  // const allVocs = new AllVocabsClass([]);
  // allUserVocabs.forEach((voc) => allVocs.addVocab(new Vocab(voc)));

  return (
    <Box>
      <h2>AllVocabs</h2>
      <SearchField setSearchTerm={setSearchString} />
      <Button onClick={() => setOpen(!open)}>Add Vocab</Button>
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
