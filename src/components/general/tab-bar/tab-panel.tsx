import { Box } from "@mui/material";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  goNext: (val: number) => void;
}

export default function TabPanel(props: TabPanelProps) {
  const { children, value, index, goNext, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
      style={{ display: "flex" }}
      className="full-width"
    >
      {value === index && (
        <Box
          sx={{
            px: 3,
            py: 0,
            display: "flex",
            flex: "1",
            minWidth: "15rem",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}
