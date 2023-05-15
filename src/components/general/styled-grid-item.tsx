import { Grid, Paper, Divider } from "@mui/material";
// import "./homescreen.styles.scss";
import { styled } from "@mui/material/styles";
import * as React from "react";
import { useNavigate } from "react-router-dom";

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
  height: 100,
}));

type Props = {
  xs: number;
  text: string;
  link?: string;
  bgImage?: string;
  darkBgColor?: string;
  hoverdarkBgColor?: string;
  lightBgColor?: string;
  hoverLightBgColor?: string;
};

const StyledGridItem = ({
  xs,
  text,
  darkBgColor,
  hoverdarkBgColor,
  lightBgColor,
  hoverLightBgColor,
  link = "/",
}: Props) => {
  const [elevation, setElevation] = React.useState(1);
  const navigate = useNavigate();

  const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#00d9ffc7",
    ...theme.typography.h6,
    padding: theme.spacing(1),
    textAlign: "center",
    color: theme.palette.text.secondary,
    height: 100,
  }));

  return (
    <Grid item xs={xs}>
      <Item
        onMouseEnter={() => setElevation(5)}
        onMouseLeave={() => setElevation(1)}
        elevation={elevation}
        onClick={() => navigate(link)}
      >
        <span className="home-paper-inner-text">{text}</span>
      </Item>
    </Grid>
  );
};

export default StyledGridItem;
