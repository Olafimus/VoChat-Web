import { Box, Typography } from "@mui/material";
import React from "react";
import ChatPic from "../../assets/images/chat-pic.jpg";
import ChatScg from "../../assets/images/chat-pic.png";

type Props = {};

const Aboutscreen = (props: Props) => {
  return (
    <section style={{ marginTop: 4 }}>
      <Typography py={2} variant="h3" textAlign="center">
        My Philosophy
      </Typography>
      <Box
        component="article"
        display="flex"
        justifyContent="center"
        sx={{ flexWrap: "wrap" }}
      >
        <Box sx={{ maxWidth: 600, minWidth: 300 }}>
          <Typography variant="body1" p={1}>
            The only way to truly learn a language is by using it. But for me it
            was always hard to actually get to use the language you want to
            learn. There are obstacles like finding someone, who speaks the
            language and finding the courage to talk to that person.
          </Typography>
          <Box display="grid" gridTemplateColumns="auto 150px">
            <Typography variant="body1" p={1}>
              To overcome these obstacles, I designed VocChat, where you can
              find likeminded people, who want to learn a new language. In
              chatting with native speakers, you can improve you skills
              significantly and even help them by teaching them your native
              language. .
            </Typography>
            <img
              height="135"
              width="135"
              // style={{ background: "black" }}
              src={ChatScg}
              alt=""
            />
          </Box>
          <Box display="grid" gridTemplateColumns="150px auto">
            {" "}
            <img
              height="120"
              width="120"
              src="https://cdn.pixabay.com/photo/2023/02/10/08/00/woman-7780330_960_720.png"
            />
            <Typography variant="body1" p={1}>
              To prevent you from forgetting the new things you have learned,
              VocChat offers the ability to save messages as notes or even
              Vocabs. To refine your knowledge, you can learn the Vocabs and add
              new ones you found in chats, outside of VocChat or in our database
            </Typography>
          </Box>
        </Box>
        <Box display="flex" flexDirection="column"></Box>
      </Box>
    </section>
  );
};

export default Aboutscreen;
