// import React, { useLayoutEffect, useState } from "react";
// import {
//   Box,
//   Typography,
//   ListItem,
//   Button,
//   IconButton,
//   Divider,
// } from "@mui/material";
// import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
// import CancelIcon from "@mui/icons-material/Cancel";
// import EditIcon from "@mui/icons-material/Edit";
// import DeleteIcon from "@mui/icons-material/Delete";
// import { Note } from "../../logic/types/note.types";
// import { useAppDispatch, useAppSelector } from "../../app/hooks";

// const Content = ({note, idx, itemColor, itemHover, theme}: {note: Note, idx: string,  itemColor: string, itemHover: string, theme: string}) => {
//   const {id: uid} = useAppSelector(state => state.user)
//   const dispatch = useAppDispatch()
//   let type = "message";
//   if (note.sender === uid) type = "note";
//   let position = "flex-start";
//   if (type === "note") position = "flex-end";

//   return (
//   <ListItem
//       sx={{
//         my: 0,
//         justifyContent: position,
//       }}
//       key={idx}
//       onClick={() => console.log(note)}
//     >
//       <Box
//         bgcolor={itemColor}
//         p={1.5}
//         px={2}
//         borderRadius={2}
//         minWidth={200}
//         sx={{
//           ":hover": {
//             cursor: "pointer",
//             bgcolor: itemHover,
//           },
//         }}
//       >
//         {note.message.map((msg, i) => {
//           return (
//             <Typography
//               key={msg}
//               color={theme === "light" ? "black" : ""}
//               variant="body1"
//             >
//               {msg}
//             </Typography>
//           );
//         })}

//         {note.note && note.note.length > 0 && (
//           <>
//             <Divider sx={{ my: 0.5 }} />
//             {note.note.map((text, i) => (
//               <Typography
//                 key={text}
//                 color={theme === "light" ? "black" : ""}
//                 variant="body2"
//               >
//                 {text}
//               </Typography>
//             ))}
//           </>
//         )}
//         <Divider sx={{ mt: 0.5 }} />
//         <Box display="flex" justifyContent="flex-end" mt={0.3}>
//           <IconButton
//             size="small"
//             sx={{ p: 0, mx: 0.5 }}
//             onClick={() => {
//               setEditNote(note);
//               setOpenAdd(true);
//             }}
//           >
//             <EditIcon />
//           </IconButton>
//           {!note.delete ? (
//             <IconButton
//               sx={{ p: 0 }}
//               size="small"
//               onClick={() => {
//                 const updatedNote: Note = { ...note, delete: true };
//                 dispatch(updateNote(updatedNote));
//               }}
//             >
//               <DeleteIcon />
//             </IconButton>
//           ) : (
//             <>
//               <Button
//                 color="error"
//                 size="small"
//                 onClick={() => dispatch(deleteNote(note))}
//                 endIcon={<DeleteIcon />}
//               >
//                 Confirm
//               </Button>
//               <IconButton
//                 size="small"
//                 onClick={() => {
//                   const updatedNote: Note = { ...note, delete: false };
//                   dispatch(updateNote(updatedNote));
//                 }}
//               >
//                 <CancelIcon />
//               </IconButton>
//             </>
//           )}

//           <Divider sx={{ mx: 0.5, height: 20 }} orientation="vertical" />
//           <IconButton
//             onClick={() => {
//               const updatedNote: Note = { ...note, checked: !note.checked };
//               console.log("dispatch: ", updatedNote);
//               dispatch(updateNote(updatedNote));
//             }}
//             size="small"
//             sx={{ p: 0 }}
//           >
//             <CheckCircleOutlineIcon
//               color={note.checked ? "success" : "disabled"}
//             />
//           </IconButton>
//         </Box>
//       </Box>
//     </ListItem>
// )}

// export const renderNote = (note: Note, idx: string) => {

//   return (

//   );
// };
