import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import React, { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/Send";

type Credentials = {
  name: string;
  mail: string;
  password: string;
};

const CredentialsStep = ({
  credentials,
  handleCredSub,
}: {
  credentials: Credentials | null;
  handleCredSub: (creds: Credentials) => void;
}) => {
  const [nameCheck, setNameCheck] = useState(true);
  const [passwordCheck, setPasswordCheck] = useState(true);
  const [mailCheck, setMailCheck] = useState(true);
  const [passwordConfirmCheck, setPasswordConfirmCheck] = useState(true);
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  // const dispatch = useAppDispatch();

  const handleSubmit = async () => {
    let checks: boolean[] = [];
    if (name.length < 3) {
      setNameCheck(false);
      checks.push(false);
    }
    if (password !== passwordConfirm) {
      setPasswordConfirmCheck(false);
      checks.push(false);
    }
    if (!mail.includes("@") || !mail.includes(".")) {
      setMailCheck(false);
      checks.push(false);
    }
    if (password.length < 6) {
      setPasswordCheck(false);
      checks.push(false);
    }

    if (checks.includes(false)) return;

    handleCredSub({ name, mail, password });
  };

  useEffect(() => {
    if (!credentials) return;
    setName(credentials.name);
    setMail(credentials.mail);
    setPassword(credentials.password);
    setPasswordConfirm(credentials.password);
  }, [credentials]);

  return (
    <section className="credentials-section">
      <Box
        // component="form"
        sx={{
          "& .MuiTextField-root": { m: 1, width: "30ch" },
        }}
        // noValidate
        // autoComplete="off"
        // fullHeight
        // fullWidth
      >
        <Typography variant="h6" textAlign="center">
          Enter your Account information
        </Typography>
        <Box display="flex" justifyContent="center" gap={50}>
          <span>
            <Box textAlign="center" m={2}>
              <TextField
                error={!nameCheck}
                id="outlined-error"
                sx={{ margin: "50px" }}
                label="Name"
                helperText={nameCheck ? "" : "This Name is too short!"}
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
            </Box>
            <Box textAlign="center">
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
                helperText={
                  passwordConfirmCheck ? "" : "Not the same password!"
                }
                onChange={(e) => setPasswordConfirm(e.currentTarget.value)}
                value={passwordConfirm}
                onClick={() => setPasswordConfirmCheck(true)}
              />
            </Box>
          </span>
        </Box>
        <span>
          <Box display="flex" justifyContent="space-around" mt={2}>
            <Button color="inherit" disabled={true} sx={{ mr: 1 }}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              endIcon={<SendIcon />}
            >
              Next
            </Button>
          </Box>
        </span>
      </Box>
    </section>
  );
};

export default CredentialsStep;
