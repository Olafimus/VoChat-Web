import React, { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { signInAuthUserWithEmailAndPassword } from "../../utils/firebase";
import { useAppDispatch } from "../../app/hooks";
import { setCurrentUser, setUserId } from "../../app/slices/user-slice";
import { CurrentUser } from "../../logic/types/user.types";
import { AuthErrorCodes, ErrorFn } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const LogInScreen = () => {
  const dispatch = useAppDispatch();
  const [passwordCheck, setPasswordCheck] = useState(true);
  const [mailCheck, setMailCheck] = useState(true);
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();

  const handleLogIn = async () => {
    if (!password.length) setPasswordCheck(false);
    if (!mail.length) setMailCheck(false);

    if (![passwordCheck, mailCheck].every((el) => el === true)) return;
    try {
      const userCred = await signInAuthUserWithEmailAndPassword(mail, password);
      if (!userCred) throw new Error("could not log in");
      // dispatch(setCurrentUser(userCred.user));
      const currentUser: CurrentUser = {
        uid: userCred.user.uid,
        email: userCred.user.email,
        emailVerified: userCred.user.emailVerified,
        isAnonymous: userCred.user.isAnonymous,
        providerData: {
          providerId: userCred.user.providerData[0].providerId,
          uid: userCred.user.providerData[0].uid,
          displayName: userCred.user.providerData[0].displayName,
          email: userCred.user.providerData[0].email,
          phoneNumber: userCred.user.providerData[0].phoneNumber,
          photoURL: userCred.user.providerData[0].photoURL,
        },
        stsTokenManager: {
          refreshToken: userCred.user.refreshToken,
          accessToken: "afd",
          expirationTime: 13242,
        },
      };

      dispatch(setCurrentUser(currentUser));
      dispatch(setUserId(userCred.user.uid));
      nav("/");
    } catch (error: any) {
      console.log(error);
      if (error.code === "auth/wrong-password") setPasswordCheck(false);
      if (error.code === "auth/user-not-found") setMailCheck(false);
    }
  };

  return (
    <section className="log-in-section">
      <Box
        component="form"
        sx={{
          "& .MuiTextField-root": { m: 1, width: "25ch" },
        }}
        noValidate
        autoComplete="off"
      >
        <Typography variant="h6">Log In</Typography>
        <div>
          <TextField
            error={!mailCheck}
            id="mail--input"
            label="E-Mail"
            type="text"
            helperText={mailCheck ? "" : "E-Mail not found"}
            onChange={(e) => setMail(e.currentTarget.value)}
            value={mail}
            onClick={() => setMailCheck(true)}
          />
          <TextField
            error={!passwordCheck}
            id="password--input"
            type="password"
            label="password"
            helperText={passwordCheck ? "" : "Password is wrong!"}
            onChange={(e) => setPassword(e.currentTarget.value)}
            value={password}
            onClick={() => setPasswordCheck(true)}
          />
        </div>
        <Button onClick={handleLogIn} variant="contained">
          Log In
        </Button>
      </Box>
      <Typography variant="body1" mt={3}>
        Not registered yet?
      </Typography>
      <Button onClick={() => nav("/signup")}>Go to Sign-Up!</Button>
    </section>
  );
};

export default LogInScreen;
