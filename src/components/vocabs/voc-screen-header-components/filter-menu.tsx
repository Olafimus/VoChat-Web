import { MouseEvent, useState } from "react";
import { styled } from "@mui/material/styles";
import {
  Menu,
  MenuItem,
  Typography,
  FormControl,
  Switch,
  Select,
  Collapse,
  Box,
  Checkbox,
} from "@mui/material";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import {
  changeVocScreenBoolSetting,
  changeVocScreenSetting,
  changeVocScreenTimeRange,
} from "../../../app/slices/settings-slice";
import { handleRenderGroupSeparator } from "flatlist-react/lib/___subComponents/uiFunctions";

type Props = {};

const hour = 1000 * 60 * 60;
const day = hour * 24;
const week = day * 7;
const month = week * 4 + day * 2;
const year = day * 365;

const timeRanges = [
  "Hour",
  "Day",
  "Week",
  "2 Weeks",
  "3 Weeks",
  "Month",
  "2 Month",
  "3 Months",
  "6 Months",
  "Year",
  "2 Years",
];

export const timeObj = {
  [hour]: "Hour",
  [day]: "Day",
  [week]: "Week",
  [2 * week]: "2 Weeks",
  [3 * week]: "3 Weeks",
  [month]: "Month",
  [2 * month]: "2 Months",
  [3 * month]: "3 Months",
  [6 * month]: "6 Months",
  [year]: "Year",
  [2 * year]: "2 Years",
};

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

const FilterMenu = (props: Props) => {
  // Filtern/Sortieren nach: Sprache, gelernt / ungelernt, Score von bis, neu
  const dispatch = useAppDispatch();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [expanded, setExpanded] = useState(false);
  const [expandedCreat, setExpandedCreat] = useState(false);
  const [expandedWb, setExpandedWb] = useState(false);
  const { vocabScreenSettings } = useAppSelector((state) => state.settings);
  const { allVocabs } = useAppSelector((state) => state.allVocabs);
  const { workbooks } = useAppSelector((state) => state.vocabs);
  const {
    friends,
    id: uid,
    name: userName,
  } = useAppSelector((state) => state.user);

  const creatorIds = allVocabs.getVocCreator();
  const creators = creatorIds.map((id) => {
    const friendName = friends.find((fr) => fr.id === id)?.name;
    const me = id === uid && userName;
    const name = me || friendName || "unknown";
    return name;
  });

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };
  const handleExpandCreatClick = () => {
    setExpandedCreat(!expandedCreat);
  };
  const handleExpandWbClick = () => {
    setExpandedWb(!expandedWb);
  };

  const calcTimeRef = (val: string) => {
    if (val === "Hour") return hour;
    if (val === "Day") return day;
    if (val === "Week") return week;
    if (val === "Month") return month;
    if (val === "Year") return year;
    const valArr = val.split(" ");
    const count = +val[0];
    if (valArr[1] === "Weeks") return count * week;
    if (valArr[1] === "Months") return count * week;
    if (valArr[1] === "Years") return count * year;
    return Date.now();
  };
  const handleTimeChange = (val: string) => {
    const time = calcTimeRef(val);
    dispatch(changeVocScreenTimeRange(time));
  };

  return (
    <span>
      <IconButton
        // edge="end"
        aria-label="options-menu"
        color="inherit"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <FilterListIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          divider
          sx={{ display: "flex", flexDirection: "column", py: 0.4 }}
        >
          <Box
            py={0}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <Typography variant="body1">Only new Vocabs</Typography>
            <Switch
              value="onlyNew"
              checked={vocabScreenSettings.onlyNew}
              onChange={(e) => {
                dispatch(
                  changeVocScreenBoolSetting({
                    name: "onlyNew",
                    value: e.currentTarget.checked,
                  })
                );
              }}
            />
          </Box>
          <Box width="100%">
            <Collapse
              in={vocabScreenSettings.onlyNew}
              timeout="auto"
              unmountOnExit
            >
              <Box
                width="100%"
                flex={1}
                sx={{
                  display: "flex",
                  justifyContent: "space-evenly",
                  alignItems: "center",
                }}
              >
                <Typography variant="body1">Last: </Typography>
                <Select
                  size="small"
                  sx={{ minWidth: 120 }}
                  value={timeObj[vocabScreenSettings.timeRange] || "Hour"}
                  onChange={(e) => {
                    const val = e.target.value as string;
                    handleTimeChange(val);
                  }}
                >
                  {timeRanges.map((el) => (
                    <MenuItem key={el} value={el}>
                      {el}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Collapse>
          </Box>
        </MenuItem>
        <MenuItem
          divider
          sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}
        >
          <Typography variant="body1">Only unlearned Vocabs</Typography>
          <Switch
            value="onlyUnlearned"
            checked={vocabScreenSettings.onlyUnlearned}
            onChange={(e) => {
              dispatch(
                changeVocScreenBoolSetting({
                  name: "onlyUnlearned",
                  value: e.currentTarget.checked,
                })
              );
            }}
          />
        </MenuItem>
        <MenuItem
          divider
          onClick={handleExpandClick}
          sx={{ display: "flex", justifyContent: "space-between", py: 0.8 }}
        >
          <Typography>Filter Languages</Typography>
          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </MenuItem>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <MenuItem
            sx={{ display: "flex", justifyContent: "space-between", py: 0.8 }}
          >
            <Typography variant="body1">Show All</Typography>
            <Checkbox
              checked={vocabScreenSettings.filterByLang.length === 0}
              onChange={(e) => {
                const check = e.currentTarget.checked;
                if (check)
                  dispatch(
                    changeVocScreenSetting({
                      ...vocabScreenSettings,
                      filterByLang: [],
                    })
                  );
              }}
            />
          </MenuItem>
          {allVocabs.getVocLangs().map((lang) => (
            <MenuItem
              key={lang}
              sx={{ display: "flex", justifyContent: "space-between", py: 0.8 }}
            >
              <Typography variant="body1">{lang}</Typography>
              <Checkbox
                checked={vocabScreenSettings.filterByLang.includes(lang)}
                onClick={(e) => {
                  const check = vocabScreenSettings.filterByLang.includes(lang);
                  if (!check) {
                    dispatch(
                      changeVocScreenSetting({
                        ...vocabScreenSettings,
                        filterByLang: [
                          ...vocabScreenSettings.filterByLang,
                          lang,
                        ],
                      })
                    );
                  } else
                    dispatch(
                      changeVocScreenSetting({
                        ...vocabScreenSettings,
                        filterByLang: vocabScreenSettings.filterByLang.filter(
                          (el) => el !== lang
                        ),
                      })
                    );
                }}
              />
            </MenuItem>
          ))}
        </Collapse>
        <MenuItem
          divider
          onClick={handleExpandWbClick}
          sx={{ display: "flex", justifyContent: "space-between", py: 0.8 }}
        >
          <Typography>Filter Workbooks</Typography>
          <ExpandMore
            expand={expandedWb}
            onClick={handleExpandWbClick}
            aria-expanded={expandedWb}
            aria-label="show more"
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </MenuItem>
        <Collapse in={expandedWb} timeout="auto" unmountOnExit>
          <MenuItem
            sx={{ display: "flex", justifyContent: "space-between", py: 0.3 }}
          >
            <Typography variant="body1">Show All</Typography>
            <Checkbox
              checked={vocabScreenSettings.wbFilter.length === 0}
              onChange={(e) => {
                const check = e.currentTarget.checked;
                if (check)
                  dispatch(
                    changeVocScreenSetting({
                      ...vocabScreenSettings,
                      wbFilter: [],
                    })
                  );
              }}
            />
          </MenuItem>
          {workbooks.map((wb) => (
            <MenuItem
              key={wb.id}
              sx={{ display: "flex", justifyContent: "space-between", py: 0.3 }}
            >
              <Typography variant="body1">{wb.name}</Typography>
              <Checkbox
                checked={vocabScreenSettings.wbFilter.includes(wb.id)}
                onClick={(e) => {
                  const check = vocabScreenSettings.wbFilter.includes(wb.id);
                  if (!check) {
                    dispatch(
                      changeVocScreenSetting({
                        ...vocabScreenSettings,
                        wbFilter: [...vocabScreenSettings.wbFilter, wb.id],
                      })
                    );
                  } else
                    dispatch(
                      changeVocScreenSetting({
                        ...vocabScreenSettings,
                        wbFilter: vocabScreenSettings.wbFilter.filter(
                          (el) => el !== wb.id
                        ),
                      })
                    );
                }}
              />
            </MenuItem>
          ))}
        </Collapse>
        <MenuItem
          divider
          onClick={handleExpandCreatClick}
          sx={{ display: "flex", justifyContent: "space-between", py: 0.8 }}
        >
          <Typography>Filter Vocab creator</Typography>
          <ExpandMore
            expand={expandedCreat}
            onClick={handleExpandCreatClick}
            aria-expanded={expandedCreat}
            aria-label="show more"
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </MenuItem>
        <Collapse in={expandedCreat} timeout="auto" unmountOnExit>
          <MenuItem
            sx={{ display: "flex", justifyContent: "space-between", py: 0.3 }}
          >
            <Typography variant="body1">Show All</Typography>
            <Checkbox
              checked={vocabScreenSettings.filterByCreator.length === 0}
              onChange={(e) => {
                const check = e.currentTarget.checked;
                if (check)
                  dispatch(
                    changeVocScreenSetting({
                      ...vocabScreenSettings,
                      filterByCreator: [],
                    })
                  );
              }}
            />
          </MenuItem>
          {creators.map((creator) => (
            <MenuItem
              key={creator}
              sx={{ display: "flex", justifyContent: "space-between", py: 0.3 }}
            >
              <Typography variant="body1">{creator}</Typography>
              <Checkbox
                checked={vocabScreenSettings.filterByCreator.includes(creator)}
                onClick={(e) => {
                  const check =
                    vocabScreenSettings.filterByCreator.includes(creator);
                  if (!check) {
                    dispatch(
                      changeVocScreenSetting({
                        ...vocabScreenSettings,
                        filterByCreator: [
                          ...vocabScreenSettings.filterByCreator,
                          creator,
                        ],
                      })
                    );
                  } else
                    dispatch(
                      changeVocScreenSetting({
                        ...vocabScreenSettings,
                        filterByCreator:
                          vocabScreenSettings.filterByCreator.filter(
                            (el) => el !== creator
                          ),
                      })
                    );
                }}
              />
            </MenuItem>
          ))}
        </Collapse>
      </Menu>
    </span>
  );
};

export default FilterMenu;
