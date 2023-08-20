import React, { useState, useEffect } from "react";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import {
  Stack,
  Box,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Typography,
  Button,
} from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import {
  changeCurLang,
  changeNativeLang,
} from "../../../app/slices/vocabs-slice";
import {
  changeLearnLangs,
  changeTeachLangs,
} from "../../../app/slices/user-slice";
import { changeDbLangs } from "../../../utils/firebase";
import { supportedLanguages as languages } from "../../../utils/country-flags";

export type LangProp = {
  vocLang: string;
  transLang: string;
  learnLangs: string[][];
  teachLangs: string[][];
};

type LangConfigProps = {
  type: "setUp" | "profile" | "settings";
  langs?: LangProp | null;
  setLangs?: (langs: LangProp) => void;
  goBack?: () => void;
  finish?: () => void;
};

const LanguageConfiguration: React.FC<LangConfigProps> = ({
  type,
  langs,
  setLangs = (langs: LangProp) => {},
  goBack,
  finish,
}) => {
  const dispatch = useAppDispatch();
  const [tempLangs, setTempLangs] = useState<LangProp>({
    vocLang: langs?.vocLang || "",
    transLang: langs?.transLang || "",
    learnLangs: langs?.learnLangs || [],
    teachLangs: langs?.teachLangs || [],
  });
  const [changed, setChanged] = useState(false);
  const {
    learnLanguages,
    teachLanguages,
    id: uid,
  } = useAppSelector((state) => state.user);
  const { currentLang, nativeLang } = useAppSelector((state) => state.vocabs);

  useEffect(() => {
    if (type === "setUp") return;
    let defVocLang = langs?.vocLang || "";
    let defTransLang = langs?.transLang || "";
    let defTeachLangs = langs?.teachLangs || [];
    let defLearnLangs = langs?.learnLangs || [];

    if (type === "profile" || type === "settings") {
      defVocLang = currentLang;
      defTransLang = nativeLang;
      defTeachLangs = teachLanguages.map(
        (teachLang) => languages.find((lang) => lang[0] === teachLang) || []
      );
      defLearnLangs = learnLanguages.map(
        (teachLang) => languages.find((lang) => lang[0] === teachLang) || []
      );
    }
    setTempLangs({
      vocLang: defVocLang,
      transLang: defTransLang,
      teachLangs: defTeachLangs,
      learnLangs: defLearnLangs,
    });
  }, [teachLanguages, learnLanguages]);

  // const handleLangSet = () => {
  //   console.log(tempLangs);
  // };

  const handleProfileChange = () => {
    const teachLangLoad = tempLangs.teachLangs.map((el) => el[0]);
    const learnLangLoad = tempLangs.learnLangs.map((el) => el[0]);
    dispatch(changeCurLang(tempLangs.vocLang));
    dispatch(changeNativeLang(tempLangs.transLang));
    dispatch(changeTeachLangs(teachLangLoad));
    dispatch(changeLearnLangs(learnLangLoad));
    changeDbLangs(
      uid,
      tempLangs.vocLang,
      tempLangs.transLang,
      teachLangLoad,
      learnLangLoad
    );
  };

  return (
    <Box>
      <Stack spacing={2} sx={{ minWidth: 300, maxWidth: 500 }}>
        {type === "setUp" && (
          <span>
            <Typography textAlign="center" variant="h6">
              Choose your language Set-Up!
            </Typography>
            <Typography textAlign="center" variant="body2">
              The Vocab Language is the default language for your vocabularies
              and the Translation Language is the default language for the
              translation of your vocabularies
            </Typography>
            <Typography textAlign="center" variant="caption">
              You can change your settings afterwards anytime
            </Typography>
          </span>
        )}
        <Box display="flex" alignItems="center" gap="0.5rem">
          <FormControl sx={{ minWidth: 175, flex: 1 }}>
            <InputLabel variant="standard" size="small">
              Vocab Language
            </InputLabel>
            <Select
              variant="standard"
              id="cur-voc-lang"
              size="small"
              label="Vocab Language"
              value={tempLangs.vocLang}
              onChange={(e) => {
                const vocLang = e.target.value as string;
                if (!vocLang) return;
                const newLang: LangProp = {
                  transLang: tempLangs.transLang || "",
                  teachLangs: tempLangs.teachLangs || [],
                  learnLangs: tempLangs.learnLangs || [],
                  vocLang,
                };
                // if (!newLang.learnLangs.find((el) => el[0] === vocLang)) {
                //   const rightLang = languages.find(
                //     (lang) => lang[0] === vocLang
                //   );
                //   console.log("rightLang: ", rightLang);
                //   if (!rightLang) return;
                //   newLang.learnLangs.push([vocLang, rightLang[1]]);
                // }
                setTempLangs(newLang);
                if (type === "setUp") setLangs(newLang);
                setChanged(true);
              }}
            >
              {languages.map((lang) => (
                <MenuItem key={lang[0]} value={lang[0]}>
                  {lang[1] + " " + lang[0]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 175, flex: 1 }}>
            <InputLabel variant="standard" size="small">
              Translation Language
            </InputLabel>
            <Select
              variant="standard"
              id="cur-trans-lang"
              size="small"
              label="Translation Language"
              value={tempLangs.transLang}
              onChange={(e) => {
                const transLang = e.target.value as string;
                const newLang: LangProp = {
                  teachLangs: tempLangs.teachLangs || [],
                  learnLangs: tempLangs.learnLangs || [],
                  vocLang: tempLangs.vocLang || "",
                  transLang,
                };
                setTempLangs(newLang);
                if (type === "setUp") setLangs(newLang);
                setChanged(true);
              }}
            >
              {languages.map((lang) => (
                <MenuItem key={lang[0]} value={lang[0]}>
                  {lang[1] + " " + lang[0]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {type === "setUp" && (
          <Typography textAlign="center" variant="body2">
            If you want to learn or teach multiple languages you can choose them
            here!
          </Typography>
        )}
        <Autocomplete
          multiple
          id="tags-standard"
          options={languages}
          getOptionLabel={(lang: string[]) => lang[1] + " " + lang[0]}
          value={tempLangs.learnLangs}
          onChange={(e, v) => {
            const learnLangs = v;
            const newLang: LangProp = {
              teachLangs: tempLangs.teachLangs || [],
              vocLang: tempLangs.vocLang || "",
              transLang: tempLangs.transLang || "",
              learnLangs,
            };
            setTempLangs(newLang);
            if (type === "setUp") setLangs(newLang);
            setChanged(true);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="standard"
              label="Learn Languages"
              placeholder="Add more"
            />
          )}
        />
        <Autocomplete
          multiple
          id="tags-standard"
          options={languages}
          getOptionLabel={(lang) => lang[1] + " " + lang[0]}
          value={tempLangs.teachLangs}
          onChange={(e, v) => {
            const teachLangs = v;
            const newLang: LangProp = {
              vocLang: tempLangs.vocLang || "",
              transLang: tempLangs.transLang || "",
              learnLangs: tempLangs.learnLangs || [],
              teachLangs,
            };
            setTempLangs(newLang);
            if (type === "setUp") setLangs(newLang);
            setChanged(true);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="standard"
              label="Teach Languges"
              placeholder="Add more"
            />
          )}
        />
      </Stack>
      {type === "setUp" && (
        <Box display="flex" justifyContent="space-between" mx={1} my={3}>
          <Button color="inherit" onClick={goBack} sx={{ mr: 1 }}>
            Back
          </Button>
          <Button
            onClick={finish}
            variant="contained"
            // endIcon={<SendIcon />}
          >
            Create Account
          </Button>
        </Box>
      )}
      {type === "profile" && (
        <Box display="flex" justifyContent="space-between" mx={1} mt={2}>
          <Button
            size="small"
            color="inherit"
            onClick={goBack}
            sx={{ mr: 1 }}
            disabled={!changed}
          >
            Reset
          </Button>
          <Button
            onClick={handleProfileChange}
            variant="contained"
            size="small"
            disabled={!changed}
            // endIcon={<SendIcon />}
          >
            Save Changes
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default LanguageConfiguration;
