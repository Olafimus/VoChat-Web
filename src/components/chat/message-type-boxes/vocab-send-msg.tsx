import { Typography, Box, Divider, Tooltip } from "@mui/material";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import { Interweave } from "interweave";
import { blue, lightBlue } from "@mui/material/colors";
import { VocObj } from "../../../logic/types/vocab.types";
import { supLangObj } from "../../../utils/constants/supported-langs";
import AddVocab, { EditProps } from "../../vocabs/add-vocab";
import { useState } from "react";
import { Vocab } from "../../../logic/classes/vocab.class";

type VocMsgProps = {
  vocab?: VocObj;
  msgHTML: string;
  myVoc: boolean;
};

const VocMsgBox = ({ vocab, msgHTML, myVoc }: VocMsgProps) => {
  const [open, setOpen] = useState(false);
  let vocFlag = undefined;
  let transFlag = undefined;
  if (!vocab) return <></>;
  let vocLang =
    vocab.vocLanguage.charAt(0).toUpperCase() + vocab.vocLanguage.slice(1);
  let transLang =
    vocab.transLanguage.charAt(0).toUpperCase() + vocab.transLanguage.slice(1);
  try {
    vocFlag = (
      <img
        src={`https://flagcdn.com/16x12/${supLangObj[
          vocLang
        ].toLowerCase()}.png`}
        srcSet={`https://flagcdn.com/32x24/${supLangObj[
          vocLang
        ].toLowerCase()}.png 2x, https://flagcdn.com/48x36/${
          supLangObj[vocLang]
        }.png 3x`}
        width="16"
        height="12"
        style={{ margin: "auto" }}
        alt={`${supLangObj[vocLang]} Flag`}
      ></img>
    );

    transFlag = (
      <img
        src={`https://flagcdn.com/16x12/${supLangObj[
          transLang
        ].toLowerCase()}.png`}
        srcSet={`https://flagcdn.com/32x24/${supLangObj[
          transLang
        ].toLowerCase()}.png 2x, https://flagcdn.com/48x36/${
          supLangObj[transLang]
        }.png 3x`}
        width="16"
        height="12  "
        style={{ margin: "auto" }}
        alt={`${supLangObj[transLang]} Flag`}
      ></img>
    );
  } catch {
    console.log("not supo");
  }
  const addProps: EditProps = {
    open,
    setOpen,
    voc: vocab.vocab.join(", "),
    tra: vocab.translation.join(", "),
    imp: vocab.setImportance || 7,
    hints: vocab.hints.join(", "),
    pronunc: vocab.pronunciation.join(", "),
    vocab: new Vocab(vocab),
    sendVoc: myVoc,
  };

  return (
    <>
      <Box>
        <Box
          p={1}
          m={1}
          border="solid"
          borderRadius={2}
          bgcolor={lightBlue[300]}
          borderColor={blue[600]}
          minWidth={250}
          sx={{
            ":hover": {
              bgcolor: blue[500],
              color: "white",
              cursor: "pointer",
            },
          }}
          onClick={() => setOpen(true)}
        >
          <Box display="flex" justifyContent="space-between" gap="0.2rem">
            <Box>
              <Typography>{vocab.vocab[0]}</Typography>
              <Typography>{vocab.vocab.slice(1).join(", ")}</Typography>
            </Box>
            <Divider variant="middle" />
            <Box>
              <Typography>{vocab.translation[0]}</Typography>
              <Typography>{vocab.translation.slice(1).join(", ")}</Typography>
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
                  fontSize={18}
                  fontWeight="bold"
                >
                  {vocFlag ? vocFlag : vocab.vocLanguage} -{" "}
                  {transFlag ? transFlag : vocab.transLanguage}
                </Typography>
              </Box>
            </Tooltip>
            <Tooltip arrow title="Categories">
              <Box display="flex" alignItems="center" gap="0.1rem">
                <CategoryRoundedIcon fontSize="small" color="secondary" />
                <Typography pl={1} variant="caption">
                  {vocab.categories.join(", ")}
                </Typography>
              </Box>
            </Tooltip>
          </Box>
        </Box>
        <Box style={{ fontSize: "16px" }}>
          <Interweave content={msgHTML} />
        </Box>
      </Box>
      <AddVocab {...addProps} />
    </>
  );
};

export default VocMsgBox;
