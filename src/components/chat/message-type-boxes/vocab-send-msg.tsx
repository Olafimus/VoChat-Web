import { Typography, Box, Divider, Tooltip } from "@mui/material";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import { red, blue, cyan, lightBlue, teal } from "@mui/material/colors";
import { VocObj } from "../../../logic/types/vocab.types";
import { supLangObj } from "../../../utils/country-flags";

type VocMsgProps = {
  vocab: VocObj;
  msgHTML: string;
};

const VocMsgBox = ({ vocab, msgHTML }: VocMsgProps) => {
  let vocFlag = undefined;
  let transFlag = undefined;
  let vocLang =
    vocab.vocLanguage.charAt(0).toUpperCase() + vocab.vocLanguage.slice(1);
  let transLang =
    vocab.transLanguage.charAt(0).toUpperCase() + vocab.transLanguage.slice(1);
  try {
    vocFlag = supLangObj[vocLang];
    transFlag = supLangObj[transLang];
  } catch {
    console.log("not supo");
  }
  return (
    <Box>
      <Box
        p={1}
        m={1}
        mr={0}
        pr={0}
        border="solid"
        borderRadius={2}
        bgcolor={lightBlue[100]}
        borderColor={blue[600]}
        minWidth={250}
        sx={{
          ":hover": {
            bgcolor: blue[400],
            color: "white",
            cursor: "pointer",
          },
        }}
      >
        <Box display="flex" justifyContent="space-between" gap="0.2rem">
          <Box>
            <Typography>{vocab.vocab[0]}</Typography>
            <Typography>{vocab.vocab.join(", ")}</Typography>
          </Box>
          <Divider variant="middle" />
          <Box>
            <Typography>{vocab.translation[0]}</Typography>
            <Typography>{vocab.translation.join(", ")}</Typography>
          </Box>
        </Box>
        <Divider orientation="vertical" />
        <Box
          display="flex"
          gap="0.4rem"
          alignItems="center"
          justifyContent="space-around"
        >
          <Tooltip arrow title="Importance">
            <Box display="flex" alignItems="center">
              <PriorityHighRoundedIcon fontSize="small" />
              <Typography variant="caption">{vocab.setImportance}</Typography>
            </Box>
          </Tooltip>{" "}
          <Tooltip arrow title="Languages">
            <Box display="flex" alignItems="center" gap="0.1rem">
              <LanguageRoundedIcon fontSize="small" />
              <Typography
                pl={1}
                sx={{ whiteSpace: "nowrap" }}
                variant="caption"
              >
                {vocFlag ? vocFlag : vocab.vocLanguage}
                {transFlag ? transFlag : vocab.transLanguage}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip arrow title="Categories">
            <Box display="flex" alignItems="center" gap="0.1rem">
              <CategoryRoundedIcon fontSize="small" color="secondary" />
              <Typography pl={1} variant="caption">
                {vocab.categories.join(", ")} asdfa asd as asdf saf sa
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
  );
};

export default VocMsgBox;
