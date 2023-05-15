import React from "react";
import { Typography, Box, Slider } from "@mui/material";

const ImportanceSlider = ({
  importance,
  setImportance,
}: {
  importance: number;
  setImportance: (val: number) => void;
}) => {
  const colors = ["green", "lightgreen", "yellow", "orange", "red"];
  let color = colors[0];

  const setColor = () => {
    if (importance > 8) color = colors[0];
    if (importance > 6 && importance < 9) color = colors[1];
    if (importance > 4 && importance < 7) color = colors[2];
    if (importance > 2 && importance < 5) color = colors[3];
    if (importance < 3) color = colors[4];
  };
  setColor();
  const marks = [
    {
      value: 0,
      label: "0",
    },
    {
      value: 2,
      label: "2",
    },
    {
      value: 4,
      label: "4",
    },
    {
      value: 6,
      label: "6",
    },
    {
      value: 8,
      label: "8",
    },
    {
      value: 10,
      label: "10",
    },
  ];

  function valuetext(value: number) {
    return `${value}`;
  }
  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <span style={{ width: "95%" }}>
        <span
          className="importance-title wrapper"
          style={{
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Typography>low</Typography>
          <Typography> --- </Typography>
          <Typography>Importance</Typography>
          <Typography>--- </Typography>
          <Typography>high</Typography>
        </span>
        <Slider
          aria-label="Custom marks"
          // defaultValue={importance}
          value={importance}
          onChange={(_, value) => {
            if (typeof value === "number") setImportance(value);
          }}
          getAriaValueText={valuetext}
          step={1}
          valueLabelDisplay="auto"
          marks={marks}
          max={10}
          sx={{ color }}
          // orientation="vertical"
        />
      </span>
    </Box>
  );
};

export default ImportanceSlider;
