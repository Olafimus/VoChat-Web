import { createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";

type ScreenStrings = "" | "contacts" | "chat";

interface Settings {
  theme: "dark" | "light";
  activeScreen: ScreenStrings;
}

const initialState: Settings = {
  theme: "dark",
  activeScreen: "",
};

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
  },
});

export const { setTheme, switchScreen } = SettingsSlice.actions;

export default SettingsSlice.reducer;
