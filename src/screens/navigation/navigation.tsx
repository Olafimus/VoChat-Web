import React, { useEffect } from "react";
import "./navigation.styles.scss";
import Logo from "../../assets/images/logo.svg";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { styled, useTheme, Theme, CSSObject } from "@mui/material/styles";
import Box from "@mui/material/Box";
import MuiDrawer from "@mui/material/Drawer";
import MuiAppBar, { AppBarProps as MuiAppBarProps } from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import CssBaseline from "@mui/material/CssBaseline";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import InfoIcon from "@mui/icons-material/Info";
import ContactsRoundedIcon from "@mui/icons-material/ContactsRounded";
import SettingsApplicationsOutlinedIcon from "@mui/icons-material/SettingsApplicationsOutlined";
import Brightness3Icon from "@mui/icons-material/Brightness3";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setTheme, switchScreen } from "../../app/slices/settings-slice";
import { resetUserState, setCurrentUser } from "../../app/slices/user-slice";
import SchoolIcon from "@mui/icons-material/School";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import SpeakerNotesOutlinedIcon from "@mui/icons-material/SpeakerNotesOutlined";
import { Avatar, Tooltip, useMediaQuery } from "@mui/material";
import { stringAvatar } from "../../components/contacts/contact-item";
import { ToastContainer } from "react-toastify";

const drawerWidth = 240;
let closedDrawerWidthOne = "50px";
let closedDrawerWidthTwo = "65px";

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: closedDrawerWidthOne,
  [theme.breakpoints.up("sm")]: {
    width: closedDrawerWidthTwo,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(["width", "margin"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": closedMixin(theme),
  }),
}));

const Navigation = () => {
  const { theme } = useAppSelector((state) => state.settings);
  const { currentUser, name, imageURL } = useAppSelector((state) => state.user);
  const { started, route } = useAppSelector((s) => s.learning);
  const dispatch = useAppDispatch();
  const navigation = useNavigate();
  const [open, setOpen] = React.useState(false);

  // const matches = useMediaQuery("(min-width:600px)");

  // useEffect(() => {
  //   console.log(matches);
  //   if (matches) {
  //     closedDrawerWidthOne = "0px";
  //     closedDrawerWidthTwo = "0px";
  //   }
  //   if (!matches) {
  //     closedDrawerWidthOne = "50px";
  //     closedDrawerWidthTwo = "65px";
  //   }
  // }, [matches]);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar className="nav-toolbar">
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 5,
              ...(open && { display: "none" }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <span className="nav-toolbar-components">
            <img
              src={Logo}
              height={35}
              width={35}
              alt="Logo"
              onClick={() => navigation("/")}
              className="pointer-cursor"
            ></img>
            <Typography
              variant="h5"
              noWrap
              overflow="hidden"
              textOverflow="ellipsis"
              component="div"
            >
              VoChat
            </Typography>
            {currentUser ? (
              <Tooltip arrow title="Go to profile page">
                <Link to="/profile">
                  {imageURL ? (
                    <Avatar alt="Profile Avatar" src={imageURL} />
                  ) : (
                    <Avatar
                      alt="Profile Avatar"
                      {...stringAvatar(name ?? "")}
                    />
                  )}
                </Link>
              </Tooltip>
            ) : (
              <Link to="login">Log In</Link>
            )}
          </span>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          <ListItem
            onClick={() => navigation("profile")}
            disablePadding
            sx={{ display: "block" }}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? "initial" : "center",
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : "auto",
                  justifyContent: "center",
                }}
              >
                <ManageAccountsIcon />
              </ListItemIcon>
              <ListItemText primary="Profile" sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
          <ListItem
            onClick={() => navigation("about")}
            disablePadding
            sx={{ display: "block" }}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? "initial" : "center",
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : "auto",
                  justifyContent: "center",
                }}
              >
                <InfoIcon />
              </ListItemIcon>
              <ListItemText primary="About" sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>

          <ListItem
            disablePadding
            onClick={() => {
              dispatch(switchScreen("contacts"));
              navigation("contacts");
            }}
            sx={{ display: "block" }}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? "initial" : "center",
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : "auto",
                  justifyContent: "center",
                }}
              >
                <ContactsRoundedIcon />
              </ListItemIcon>
              <ListItemText primary="Contacts" sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        </List>
        <Divider />

        <ListItem
          disablePadding
          sx={{ display: "block" }}
          onClick={() => {
            if (theme === "light") dispatch(setTheme("dark"));
            else dispatch(setTheme("light"));
          }}
        >
          <ListItemButton
            sx={{
              minHeight: 48,
              justifyContent: open ? "initial" : "center",
              px: 2.5,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: open ? 3 : "auto",
                justifyContent: "center",
              }}
            >
              {theme === "light" ? <Brightness3Icon /> : <LightModeIcon />}
            </ListItemIcon>
            <ListItemText
              primary={theme === "light" ? "Dark Mode" : "Light Mode"}
              sx={{ opacity: open ? 1 : 0 }}
            />
          </ListItemButton>
        </ListItem>
        <List>
          <Divider />
          <ListItem
            onClick={() => {
              started
                ? navigation(`/vocab/learning/${route}`)
                : navigation("/vocab/learning");
            }}
            disablePadding
            sx={{ display: "block" }}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? "initial" : "center",
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : "auto",
                  justifyContent: "center",
                }}
              >
                <SchoolIcon />
              </ListItemIcon>
              <ListItemText primary="Learn" sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
          <ListItem
            onClick={() => navigation("/vocab")}
            disablePadding
            sx={{ display: "block" }}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? "initial" : "center",
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : "auto",
                  justifyContent: "center",
                }}
              >
                <ListAltRoundedIcon />
              </ListItemIcon>
              <ListItemText
                primary="All Vocabs"
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
          <ListItem
            onClick={() => navigation("/vocab/workbooks")}
            disablePadding
            sx={{ display: "block" }}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? "initial" : "center",
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : "auto",
                  justifyContent: "center",
                }}
              >
                <AutoStoriesRoundedIcon />
              </ListItemIcon>
              <ListItemText
                primary="Workbooks"
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
          <ListItem
            onClick={() => navigation("/notebook")}
            disablePadding
            sx={{ display: "block" }}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? "initial" : "center",
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : "auto",
                  justifyContent: "center",
                }}
              >
                <SpeakerNotesOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Notebook" sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      <DrawerHeader />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,

          marginTop: "2.0rem",
          alignSelf: "center",
          padding: "0.2rem",
        }}
      >
        <Outlet />
        <ToastContainer />
      </Box>
    </Box>
  );
};

export default Navigation;
