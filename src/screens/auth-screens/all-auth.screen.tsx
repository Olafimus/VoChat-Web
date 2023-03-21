import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import "./all-auth.styles.scss";
import LogInScreen from "./login.screen";
import SignUpScreen from "./signUp.screen";

const AllAuthScreens = () => {
  const { currentUser } = useAppSelector((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate("/contacts");
  }, [currentUser]);

  return (
    <>
      <main className="auth-container">
        <SignUpScreen />
        <LogInScreen />
      </main>
    </>
  );
};

export default AllAuthScreens;
