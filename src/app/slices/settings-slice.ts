import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type ScreenStrings = "" | "contacts" | "chat";
type VocabSubSettings = {
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
type VocabScreenSettings = {
  keepSettings: boolean;
  maxVocs: number;
  catFilter: string[];
  wbFilter: string[];
  onlyNew: boolean;
  onlyUnlearned: boolean;
  filterByLang: string[];
  filterByCreator: string[];
  sortBy: "date" | "score" | "importance" | "none";
  sortOrder: "standard" | "reversed";
  timeRange: number;
};

interface Settings {
  theme: "dark" | "light";
  activeScreen: ScreenStrings;
  vocabScreenSettings: VocabScreenSettings;
  vocabSubSettings: VocabSubSettings;
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

const initalVocabScreenSettings: VocabScreenSettings = {
  keepSettings: false,
  maxVocs: 100,
  catFilter: [],
  wbFilter: [],
  onlyNew: false,
  onlyUnlearned: false,
  filterByLang: [],
  filterByCreator: [],
  sortBy: "none",
  sortOrder: "standard",
  timeRange: 0,
};

const initalVocabSubSettings = {
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
};

const initialState: Settings = {
  theme: "dark",
  activeScreen: "",
  vocabScreenSettings: initalVocabScreenSettings,
  vocabSubSettings: initalVocabSubSettings,
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

export type VocScreenSetIdentifier = "onlyNew" | "onlyUnlearned";

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
    changeMaxShownVocs: (state, action: PayloadAction<number>) => {
      state.vocabScreenSettings.maxVocs = action.payload;
    },
    changeVocCatFilter: (state, action: PayloadAction<string[]>) => {
      state.vocabScreenSettings.catFilter = action.payload;
    },
    changeVocScreenTimeRange: (state, action: PayloadAction<number>) => {
      state.vocabScreenSettings.timeRange = action.payload;
    },
    keepScreenSettings: (state, action: PayloadAction<boolean>) => {
      state.vocabScreenSettings.keepSettings = action.payload;
    },
    resetScreenSettings: (state) => {
      state.vocabScreenSettings = initalVocabScreenSettings;
    },
    changeVocScreenBoolSetting: (
      state,
      action: PayloadAction<{ name: VocScreenSetIdentifier; value: boolean }>
    ) => {
      state.vocabScreenSettings[action.payload.name] = action.payload.value;
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
  changeMaxShownVocs,
  changeVocCatFilter,
  keepScreenSettings,
  resetScreenSettings,
  changeVocScreenBoolSetting,
  changeVocScreenTimeRange,
} = SettingsSlice.actions;

export default SettingsSlice.reducer;
