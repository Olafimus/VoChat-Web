import React, { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { signInAuthUserWithEmailAndPassword } from "../../utils/firebase";
import { useAppDispatch } from "../../app/hooks";
import { setCurrentUser } from "../../app/slices/user-slice";

const LogInScreen = () => {
  const dispatch = useAppDispatch();
  const [passwordCheck, setPasswordCheck] = useState(true);
  const [mailCheck, setMailCheck] = useState(true);
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogIn = async () => {
    if (!password.length) setPasswordCheck(false);
    if (!mail.length) setMailCheck(false);

    if (![passwordCheck, mailCheck].every((el) => el === true)) return;
    try {
      const userCred = await signInAuthUserWithEmailAndPassword(mail, password);
      if (!userCred) throw new Error("could not log in");
      dispatch(setCurrentUser(userCred.user));
    } catch (error) {
      console.log(error);
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
            id="outlined-error-helper-text"
            label="E-Mail"
            type="text"
            helperText={mailCheck ? "" : "This is no E-Mail!"}
            onChange={(e) => setMail(e.currentTarget.value)}
            value={mail}
            onClick={() => setMailCheck(true)}
          />
          <TextField
            error={!passwordCheck}
            id="outlined-error-helper-text"
            type="password"
            label="password"
            helperText={passwordCheck ? "" : "Password too short!"}
            onChange={(e) => setPassword(e.currentTarget.value)}
            value={password}
            onClick={() => setPasswordCheck(true)}
          />
        </div>
        <Button onClick={handleLogIn} variant="contained">
          Log In
        </Button>
      </Box>
    </section>
  );
};

export default LogInScreen;
