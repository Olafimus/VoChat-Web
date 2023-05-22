import { createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";

type ScreenStrings = "" | "contacts" | "chat";

interface Settings {
  theme: "dark" | "light";
  activeScreen: ScreenStrings;
  vocabSubSettings: {
    closeAfterAdd: boolean;
    closeAfterEdit: boolean;
    submitWithEnter: boolean;
    needConfirmation: boolean;
    showWbs: boolean;
    keepWbs: boolean;
    showCat: boolean;
    showImp: boolean;
    showHints: boolean;
    showPronunc: boolean;
  };
  vocabLearnSettings: {
    defaultVocCount: number;
    checkingConditions: "strict" | "loose";
  };
}

const initialState: Settings = {
  theme: "dark",
  activeScreen: "",
  vocabSubSettings: {
    closeAfterAdd: false,
    closeAfterEdit: false,
    submitWithEnter: false,
    needConfirmation: false,
    showWbs: true,
    keepWbs: false,
    showCat: true,
    showImp: true,
    showHints: true,
    showPronunc: true,
  },
  vocabLearnSettings: {
    defaultVocCount: 20,
    checkingConditions: "strict",
  },
};

export type VocSetIdentifier =
  | "closeAfterAdd"
  | "closeAfterEdit"
  | "submitWithEnter"
  | "needConfirmation"
  | "showWbs"
  | "keepWbs"
  | "showCat"
  | "showImp"
  | "showHints"
  | "showPronunc";

export const SettingsSlice = createSlice({
  name: "Settings",
  initialState,
  reducers: {
    setTheme: (state, { payload }) => {
      state.theme = payload;
    },
    switchScreen: (state, action: PayloadAction<ScreenStrings>) => {
      state.activeScreen = action.payload;
    },
    changeVocBoolSetting: (
      state,
      action: PayloadAction<{ name: VocSetIdentifier; value: boolean }>
    ) => {
      state.vocabSubSettings[action.payload.name] = action.payload.value;
    },
    changeDefaultVocCount: (state, action: PayloadAction<number>) => {
      state.vocabLearnSettings.defaultVocCount = action.payload;
    },
  },
});

export const {
  setTheme,
  switchScreen,
  changeVocBoolSetting,
  changeDefaultVocCount,
} = SettingsSlice.actions;

export default SettingsSlice.reducer;
