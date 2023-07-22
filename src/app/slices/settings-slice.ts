import { createSlice, PayloadAction } from "@reduxjs/toolkit";

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
  notebookFilterSet: {
    showChecked: boolean;
    filterBy: "none" | "language" | "sender";
    language: string | null;
    sender: string | null;
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
  notebookFilterSet: {
    showChecked: true,
    filterBy: "none",
    language: null,
    sender: null,
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
    changeNoteShowChecked: (state, action: PayloadAction<boolean>) => {
      state.notebookFilterSet.showChecked = action.payload;
    },
    changeNoteFilter: (
      state,
      action: PayloadAction<"language" | "sender" | "none">
    ) => {
      state.notebookFilterSet.filterBy = action.payload;
      if (action.payload === "none") {
        state.notebookFilterSet.language = null;
        state.notebookFilterSet.sender = null;
      }
    },
    changeNoteFiltLang: (state, action: PayloadAction<string | null>) => {
      state.notebookFilterSet.language = action.payload;
    },
    changeNoteSender: (state, action: PayloadAction<string | null>) => {
      state.notebookFilterSet.sender = action.payload;
    },
  },
});

export const {
  setTheme,
  switchScreen,
  changeNoteFiltLang,
  changeNoteSender,
  changeNoteShowChecked,
  changeVocBoolSetting,
  changeDefaultVocCount,
  changeNoteFilter,
} = SettingsSlice.actions;

export default SettingsSlice.reducer;
