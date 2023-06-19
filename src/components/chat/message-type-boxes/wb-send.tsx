import React from "react";
import { Typography, Box, Divider, Tooltip } from "@mui/material";
import { supLangObj } from "../../../utils/country-flags";
import { WorkbookType } from "../../../logic/types/vocab.types";
import FunctionsIcon from "@mui/icons-material/Functions";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import WorkbookView from "./../../vocabs/workbook-components/workbook-view";

const WbMsgBox = ({
  wb,
  wbCount,
  msgHTML,
}: {
  wb?: WorkbookType;
  wbCount?: number;
  msgHTML: string;
}) => {
  // const wbVocs = [dummyVocObj] // erst im wbView fetchen aus shared WB Document
  const [open, setOpen] = React.useState(false);
  if (!wb) return <></>;
  let vocFlag = undefined;
  let transFlag = undefined;
  let vocLang = wb.vocLanguage;
  let transLang = wb.transLanguage;
  try {
    vocFlag = supLangObj[vocLang];
    transFlag = supLangObj[transLang];
  } catch {
    console.log("not supported");
  }

  return (
    <>
      <Box onClick={() => setOpen(true)}>
        <Box
          p={1}
          m={1}
          mr={0}
          border="solid"
          borderRadius={2}
          bgcolor="#ff8a65"
          borderColor="#f4511e"
          minWidth={250}
          sx={{
            ":hover": {
              bgcolor: "#ff5722",
              color: "white",
              cursor: "pointer",
            },
          }}
        >
          <Typography sx={{ textAlign: "center" }} variant="h6">
            {wb.name}
          </Typography>

          <Divider orientation="vertical" />
          <Box
            display="flex"
            gap="0.4rem"
            alignItems="center"
            justifyContent="space-around"
          >
            <Tooltip arrow title="Count of Vocabs">
              <Box display="flex" alignItems="center">
                <Typography sx={{ whiteSpace: "nowrap" }} variant="caption">
                  Vocab Count:{" "}
                </Typography>
                <FunctionsIcon fontSize="small" />
                <Typography pl={0.5} fontWeight="bold" variant="caption">
                  {wbCount}
                </Typography>
              </Box>
            </Tooltip>
            <Divider orientation="vertical" sx={{ height: "100%" }} />
            <Tooltip arrow title="Languages">
              <Box display="flex" alignItems="center" gap="0.1rem">
                <LanguageRoundedIcon fontSize="small" />
                <Typography
                  pl={1}
                  sx={{ whiteSpace: "nowrap" }}
                  variant="caption"
                >
                  {vocFlag ? vocFlag : wb.vocLanguage} -{" "}
                  {transFlag ? transFlag : wb.transLanguage}{" "}
                </Typography>
              </Box>
            </Tooltip>
          </Box>
        </Box>
        <Typography
          dangerouslySetInnerHTML={{ __html: msgHTML }}
          variant="body1"
          style={{ fontSize: "16px" }}
        ></Typography>
      </Box>
      <WorkbookView wb={wb} wbVocRef={wb.id} open={open} setOpen={setOpen} />
    </>
  );
};

export default WbMsgBox;
