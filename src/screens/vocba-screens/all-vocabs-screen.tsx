import React, { useState, memo, useEffect } from "react";
import AddVocab from "../../components/vocabs/add-vocab";
import VocabCardList from "../../components/vocabs/vocab-card-components/all-vocabs-list";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Pagination from "@mui/material/Pagination";
import { Box, Menu, MenuItem, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchField from "../../components/general/search-field";
import { useAppSelector } from "../../app/hooks";
import { Button } from "@mui/material";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";
import { loadPreVocs } from "../../utils/firebase/firebase-vocab";
import VocHeader from "../../components/vocabs/vocab-header";

const AllVocabs = () => {
  const [searchString, setSearchString] = useState("");
  const [dbLang, setDbLang] = useState<null | string>(null);
  const [open, setOpen] = useState(false);
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const { id: uid } = useAppSelector((state) => state.user);
  const [render, setRender] = useState(false);
  const [dataVocs, setDataVocs] = useState<null | AllVocabsClass>(null);
  // let check = allVocabs.getAllVocs.length > 0;
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openDbMen = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  // useEffec;
  const languages = [
    "Dutch",
    "Farsi",
    "French",
    "German",
    "Italian",
    "Japanese",
    "Korean",
  ];
  const handleDbLoad = async () => {
    if (!dbLang) return;
    const data = await loadPreVocs(dbLang, workbooks, uid);
    const newVocs = new AllVocabsClass([]);
    data.forEach((voc) => newVocs.addVocab(new Vocab(voc)));
    setDataVocs(newVocs);
    handleClose();
  };

  useEffect(() => {
    if (!dbLang) return;
    handleDbLoad();
  }, [dbLang]);

  const oldContent = () => (
    <>
      <Typography variant="h5">
        {dbLang ? `${dbLang} Database Vocabs` : "All your Vocabs"}
      </Typography>
      <Box display="flex" flexDirection="row" justifyContent="center" mb={2}>
        <SearchField setSearchTerm={setSearchString} />
        {!dbLang && (
          <Button
            sx={{ mx: 1 }}
            size="large"
            onClick={() => setOpen(!open)}
            endIcon={<AddIcon />}
          >
            Add
          </Button>
        )}
        <Button onClick={handleClick}>DB Vocs</Button>
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={openDbMen}
          onClose={handleClose}
          MenuListProps={{
            "aria-labelledby": "basic-button",
          }}
        >
          <MenuItem
            onClick={() => {
              setDataVocs(null);
              setDbLang(null);
              handleClose();
            }}
          >
            None
          </MenuItem>
          {languages.map((lang) => (
            <MenuItem onClick={() => setDbLang(lang)}>{lang}</MenuItem>
          ))}
        </Menu>
      </Box>
      {!dbLang && (
        <AddVocab
          open={open}
          setOpen={setOpen}
          render={render}
          setRender={setRender}
        />
      )}
      <VocabCardList
        dataVocs={dataVocs}
        allVocs={allVocabs}
        render={render}
        searchString={searchString}
      />
    </>
  );

  const [page, setPage] = React.useState(1);
  const handleChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };
  const handleDelete = () => {
    console.info("You clicked the delete icon.");
  };

  const backgroundColor = "white";

  return (
    <Box minHeight="73dvh">
      <VocHeader />
      <Box
        border="2px solid lightgrey"
        mt={4}
        p={1}
        height="68dvh"
        sx={{ position: "relative" }}
      >
        <Box position="absolute" top={0} sx={{ transform: "translateY(-50%)" }}>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              sx={{ backgroundColor }}
              label="Spanish"
              variant="outlined"
              onDelete={handleDelete}
            />
            <Chip
              size="small"
              sx={{ backgroundColor }}
              label="not learned"
              variant="outlined"
              onDelete={handleDelete}
            />
          </Stack>
        </Box>
        <VocabCardList
          dataVocs={dataVocs}
          allVocs={allVocabs}
          render={render}
          searchString={searchString}
        />
        <Box
          width="100%"
          display="flex"
          justifyContent="center"
          position="absolute"
          bottom={0}
          sx={{ transform: "translateY(50%)" }}
        >
          <Box
            display="flex"
            p={0.25}
            sx={{
              backgroundColor,
              border: "2px solid lightgrey",
              borderRadius: 2,
            }}
          >
            <Typography variant="body1">100</Typography>
            <Pagination
              size="small"
              count={2}
              page={page}
              onChange={handleChange}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AllVocabs;
