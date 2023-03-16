import { createSlice, nanoid } from "@reduxjs/toolkit";

interface Settings {
  theme: "dark" | "light";
}

const initialState: Settings = {
  theme: "light",
};

export const SettingsSlice = createSlice({
  name: "Settings",
  initialState,
  reducers: {
    setTheme: (state, { payload }) => {
      state.theme = payload;
    },
  },
});

export const { setTheme } = SettingsSlice.actions;

export default SettingsSlice.reducer;
