import * as React from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { green } from "@mui/material/colors";
import Fab from "@mui/material/Fab";
import CheckIcon from "@mui/icons-material/Check";
import SaveIcon from "@mui/icons-material/Save";
import { uploadFile } from "../../utils/firebase";
import { Tooltip, Typography } from "@mui/material";
import { useAppDispatch } from "../../app/hooks";
import { setUserImageURL } from "../../app/slices/user-slice";

function resizeImage(
  inputImage: File,
  maxSizeKB: number,
  callback: (val: Blob | null) => void
) {
  const image = new Image();
  image.onload = function () {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // Berechne die Zielgröße des Bildes basierend auf der gegebenen Dateigröße
    const maxSizeBytes = maxSizeKB * 1024;
    let width = image.width;
    let height = image.height;
    let scaleFactor = 1;

    while (width * height * 4 > maxSizeBytes) {
      scaleFactor -= 0.1;
      width = Math.floor(image.width * scaleFactor);
      height = Math.floor(image.height * scaleFactor);
    }

    // Setze die Größe des Canvas-Elements entsprechend der Zielgröße
    canvas.width = width;
    canvas.height = height;

    // Zeichne das verkleinerte Bild auf das Canvas
    if (!context) return;
    context.drawImage(image, 0, 0, width, height);

    // Konvertiere das verkleinerte Bild zurück in eine Datei
    canvas.toBlob(function (blob) {
      callback(blob);
    }, inputImage.type);
  };

  image.src = URL.createObjectURL(inputImage);
}

export default function PictureUploadButton({
  selectedImage,
  uid,
}: {
  selectedImage: File | null;
  uid: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const dispatch = useAppDispatch();

  const buttonSx = {
    width: 35,
    height: 30,
    ...(success && {
      bgcolor: green[500],
      "&:hover": {
        bgcolor: green[700],
      },
    }),
  };

  const handleUpload = () => {
    if (!selectedImage) return;
    resizeImage(selectedImage, 1000, (resizedImage) => {
      if (!resizedImage) throw new Error("something went wrong with resizing");
      console.log(resizedImage.size);
      const url = URL.createObjectURL(resizedImage);

      setSuccess(false);
      setLoading(true);
      uploadFile(selectedImage, uid)
        .then((res) => {
          setSuccess(true);
          setLoading(false);
          console.log("response: ", res);
          if (res) dispatch(setUserImageURL(res));
        })
        .catch((error) => {
          setSuccess(false);
          setLoading(false);
        });
    });
  };

  return (
    <>
      <Tooltip
        arrow
        title={selectedImage ? "Upload Picture" : "Choose a Picture first"}
      >
        <Box
          border={"2px solid "}
          borderRadius={4}
          borderColor={success ? green[500] : "primary.main"}
          position="relative"
          mt={1}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={handleUpload}
        >
          <Box sx={{ m: 1, position: "relative" }}>
            <Fab aria-label="save" color="primary" sx={buttonSx}>
              {success ? <CheckIcon /> : <SaveIcon />}
            </Fab>
            {loading && (
              <CircularProgress
                size={48}
                sx={{
                  color: green[500],
                  position: "absolute",
                  top: -6.0,
                  left: -6.0,
                  zIndex: 1,
                }}
              />
            )}
          </Box>
          <Typography
            color={success ? green[500] : "primary"}
            pr={1}
            variant="body1"
            fontWeight="bold"
            fontSize="1.3em"
          >
            Upload
          </Typography>
          {/* {loading && (
        <CircularProgress
          size={24}
          sx={{
            color: green[500],
            position: "absolute",
            top: "50%",
            left: "65%",
            marginTop: "-12px",
            marginLeft: "-12px",
          }}
        />
      )} */}
          {/* <Box sx={{ m: 1, position: "relative" }}>
        <Button
          variant="contained"
          sx={buttonSx}
          disabled={loading}
          onClick={handleButtonClick}
        >
          Upload
        </Button>
        {loading && (
          <CircularProgress
            size={24}
            sx={{
              color: green[500],
              position: "absolute",
              top: "50%",
              left: "50%",
              marginTop: "-12px",
              marginLeft: "-12px",
            }}
          />
        )}
      </Box> */}
        </Box>
      </Tooltip>
    </>
  );
}
