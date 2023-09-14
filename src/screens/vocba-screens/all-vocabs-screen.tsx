import React, { useState, memo, useEffect } from "react";
import VocabCardList from "../../components/vocabs/vocab-card-components/all-vocabs-list";
import Pagination from "@mui/material/Pagination";
import { Box } from "@mui/material";

import { useAppSelector } from "../../app/hooks";

import VocHeader from "../../components/vocabs/vocab-header";

import FilterChip from "./vocab-screen-subcomponents/filter-chips";

const AllVocabs = () => {
  const [searchString, setSearchString] = useState("");
  const [render, setRender] = useState(false);
  const { allVocabs, dataVocs } = useAppSelector((state) => state.allVocabs);
  const { theme } = useAppSelector((state) => state.settings);
  const { maxPages } = useAppSelector(
    (state) => state.settings.vocabScreenSettings
  );

  const [page, setPage] = React.useState(1);
  useEffect(() => {
    if (page > maxPages) setPage(maxPages);
  }, [maxPages]);
  const handleChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const backgroundColor = theme === "light" ? "white" : "#263238";

  return (
    <>
      <VocHeader
        theme={theme}
        // dbLang={dbLang}
        setSearchString={setSearchString}
        searchString={searchString}
      />
      <Box minHeight="73dvh" mt={10}>
        <Box
          border="2px solid lightgrey"
          mt={4}
          mb={3}
          p={1}
          minHeight="68dvh"
          sx={{ position: "relative" }}
        >
          <Box
            position="absolute"
            top={0}
            sx={{ transform: "translateY(-50%)" }}
          >
            <FilterChip />
          </Box>
          <VocabCardList
            page={page}
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
              <Pagination
                size="small"
                count={maxPages}
                page={page}
                onChange={handleChange}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default AllVocabs;
