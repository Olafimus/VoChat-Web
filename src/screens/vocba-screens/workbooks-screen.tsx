import React, { useState } from "react";
import WorkbookCardList from "../../components/vocabs/workbook-components/all-workbooks-list";
import SearchField from "../../components/general/search-field";

const WorkbooksScreen = () => {
  const [searchString, setSearchString] = useState("");
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);

  return (
    <>
      <SearchField setSearchTerm={setSearchString} />
      <WorkbookCardList searchString={searchString} render={render} />
    </>
  );
};

export default WorkbooksScreen;
