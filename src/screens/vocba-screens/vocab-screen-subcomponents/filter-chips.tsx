import React from "react";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import {
  VocScreenSetIdentifier,
  changeVocScreenBoolSetting,
  changeVocScreenSetting,
} from "../../../app/slices/settings-slice";
import { timeObj } from "../../../components/vocabs/voc-screen-header-components/filter-menu";
type Props = {};

const FilterChip = (props: Props) => {
  const { theme, vocabScreenSettings } = useAppSelector(
    (state) => state.settings
  );

  const {
    onlyNew,
    timeRange,
    onlyUnlearned,
    filterByCreator,
    filterByLang,
    wbFilter,
    catFilter,
  } = vocabScreenSettings;

  const { workbooks } = useAppSelector((state) => state.vocabs);

  const wbNames = wbFilter.map((wbID) => {
    const name = workbooks.find((wb) => wb.id === wbID)?.name || "not found";
    return name;
  });

  // useEffec;

  const dispatch = useAppDispatch();
  const handleLangDelete = (lang: string) => {
    dispatch(
      changeVocScreenSetting({
        ...vocabScreenSettings,
        filterByLang: filterByLang.filter((el) => el !== lang),
      })
    );
  };
  const handleCatDelete = (cat: string) => {
    const catFilter =
      cat === "all"
        ? []
        : vocabScreenSettings.catFilter.filter((el) => el !== cat);
    dispatch(
      changeVocScreenSetting({
        ...vocabScreenSettings,
        catFilter,
      })
    );
  };
  const handleWbDelete = (wb: string) => {
    const wbFilter =
      wb === "all"
        ? []
        : vocabScreenSettings.wbFilter.filter((el) => el !== wb);
    dispatch(
      changeVocScreenSetting({
        ...vocabScreenSettings,
        wbFilter,
      })
    );
  };
  const handleCreatorDelete = (creator: string) => {
    dispatch(
      changeVocScreenSetting({
        ...vocabScreenSettings,
        filterByCreator: filterByCreator.filter((el) => el !== creator),
      })
    );
  };
  const deleteBoolSetting = (name: VocScreenSetIdentifier) => {
    dispatch(changeVocScreenBoolSetting({ name, value: false }));
  };

  const backgroundColor = theme === "light" ? "white" : "#263238";

  return (
    <Stack direction="row" spacing={1} overflow="auto" maxWidth="70dvw">
      {filterByLang.map((lang) => (
        <Chip
          key={lang}
          size="small"
          sx={{ backgroundColor }}
          label={lang}
          variant="outlined"
          onDelete={() => handleLangDelete(lang)}
        />
      ))}
      {onlyUnlearned && (
        <Chip
          size="small"
          sx={{ backgroundColor }}
          label="not learned"
          variant="outlined"
          onDelete={() => deleteBoolSetting("onlyUnlearned")}
        />
      )}
      {onlyNew && (
        <Chip
          size="small"
          sx={{ backgroundColor }}
          label={"last: " + timeObj[timeRange]}
          variant="outlined"
          onDelete={() => deleteBoolSetting("onlyNew")}
        />
      )}
      {catFilter.length > 0 && (
        <Chip
          size="small"
          sx={{ backgroundColor }}
          label={`Categories: ${catFilter.join(", ")}`}
          variant="outlined"
          onDelete={() => handleCatDelete("all")}
        />
      )}
      {wbNames.length > 0 && (
        <Chip
          size="small"
          sx={{ backgroundColor }}
          label={`Workbooks: ${wbNames.join(", ")}`}
          variant="outlined"
          onDelete={() => handleWbDelete("all")}
        />
      )}
      {filterByCreator.length > 0 && (
        <Chip
          size="small"
          sx={{ backgroundColor }}
          label={`Creator: ${vocabScreenSettings.filterByCreator.join(", ")}`}
          variant="outlined"
          onDelete={() => handleCreatorDelete("all")}
        />
      )}
    </Stack>
  );
};

export default FilterChip;
