import React, { useState } from "react";
import WorkbookCardList from "../../components/vocabs/workbook-components/all-workbooks-list";
import SearchField from "../../components/general/search-field";
import { Box, Typography } from "@mui/material";

const WorkbooksScreen = () => {
  const [searchString, setSearchString] = useState("");
  const [render, setRender] = useState(false);

  return (
    <>
      <Box minHeight="70dvh">
        <Typography variant="h5"> Workbooks</Typography>
        <SearchField setSearchTerm={setSearchString} label="Search Workbook" />
        <WorkbookCardList searchString={searchString} render={render} />
      </Box>
    </>
  );
};

export default WorkbooksScreen;
