import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import React, { useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/Send";
import {
  createAuthUserWithEmailAndPassword,
  createUserDocumentFromAuth,
} from "../../utils/firebase";
import { User } from "firebase/auth";
import { useAppDispatch } from "../../app/hooks";
import { setCurrentUser } from "../../app/slices/user-slice";

const SignUpScreen = () => {
  const [nameCheck, setNameCheck] = useState(true);
  const [passwordCheck, setPasswordCheck] = useState(true);
  const [mailCheck, setMailCheck] = useState(true);
  const [passwordConfirmCheck, setPasswordConfirmCheck] = useState(true);
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const dispatch = useAppDispatch();

  const handleSubmit = async () => {
    if (name.length < 3) setNameCheck(false);
    if (password !== passwordConfirm) setPasswordConfirmCheck(false);
    if (!mail.includes("@") || !mail.includes(".")) setMailCheck(false);
    if (password.length < 6) setPasswordCheck(false);

    if (
      ![passwordCheck, nameCheck, mailCheck, passwordConfirmCheck].every(
        (el) => el === true
      )
    )
      return;

    try {
      // const user = await createAuthUserWithEmailAndPassword(mail, password);
      const displayName: string = name;
      // if (!user) throw new Error("fail");
      // await createUserDocumentFromAuth(user.user, Credential.name, );
      // dispatch(setCurrentUser(user.user));
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <section className="sign-up-section">
      <Box
        component="form"
        sx={{
          "& .MuiTextField-root": { m: 1, width: "25ch" },
        }}
        noValidate
        height="100%"
        autoComplete="off"
      >
        <Typography variant="h6">Create an Account</Typography>
        <div>
          <TextField
            error={!nameCheck}
            id="outlined-error"
            label="Name"
            onChange={(e) => setName(e.currentTarget.value)}
            value={name}
            onClick={() => setNameCheck(true)}
          />
          <TextField
            error={!mailCheck}
            id="mail--signup--input"
            label="E-Mail"
            type="text"
            helperText={mailCheck ? "" : "This is no E-Mail!"}
            onChange={(e) => setMail(e.currentTarget.value)}
            value={mail}
            onClick={() => setMailCheck(true)}
          />
        </div>
        <div>
          <TextField
            error={!passwordCheck}
            id="password--confirmation--input"
            type="password"
            label="password"
            helperText={passwordCheck ? "" : "Password too short!"}
            onChange={(e) => setPassword(e.currentTarget.value)}
            value={password}
            onClick={() => setPasswordCheck(true)}
          />
          <TextField
            error={!passwordConfirmCheck}
            id="password--confirm--input"
            type="password"
            label="confirm password"
            helperText={passwordConfirmCheck ? "" : "Not the same password!"}
            onChange={(e) => setPasswordConfirm(e.currentTarget.value)}
            value={passwordConfirm}
            onClick={() => setPasswordConfirmCheck(true)}
          />
        </div>
      </Box>
      <Button onClick={handleSubmit} variant="contained" endIcon={<SendIcon />}>
        Submit
      </Button>
    </section>
  );
};

export default SignUpScreen;
