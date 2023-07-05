import React from "react";
import {
  Box,
  Avatar,
  Typography,
  Divider,
  Grid,
  FormControl,
  Stack,
  Paper,
} from "@mui/material";

let paperStyle = {
  p: "10px",
  border: "solid 2px",
  borderRadius: "10px",
  borderColor: "#78909c",
};

export default function SectionPaper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Paper
      elevation={2}
      sx={{
        ...paperStyle,
      }}
    >
      {children}
    </Paper>
  );
}
