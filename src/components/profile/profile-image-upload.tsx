import { Modal, Box, Typography, Button } from "@mui/material";
import * as React from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setUserImageURL } from "../../app/slices/user-slice";
import { loadUserImage, uploadFile } from "../../utils/firebase";

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

export default function ProfileImageUpload({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (val: boolean) => void;
}) {
  const [imageURL, setImageURL] = React.useState("");
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const dispatch = useAppDispatch();
  const { id: uid } = useAppSelector((s) => s.user);

  const handleUploadSuccess = async () => {
    // const url = await loadUserImage(uid);
    // if (!url) return;
    // dispatch(setUserImageURL(url));
    // console.log(uploaded);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files || [];
    if (file.length > 0) {
      setSelectedImage(file[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedImage) return;
    resizeImage(selectedImage, 10000, (resizedImage) => {
      if (!resizedImage) throw new Error("something went wrong with resizing");
      console.log(resizedImage.size);
      const url = URL.createObjectURL(resizedImage);

      uploadFile(selectedImage, uid)
        .then(() => {
          handleUploadSuccess();
        })
        .catch((error) => console.log(error));
    });
  };
  const handleClose = () => setOpen(false);
  // console.log(selectedImage?.size);

  const style = {
    position: "absolute" as "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
    minHeight: 500,
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography id="modal-modal-title" variant="h5" component="h2">
            Select a Profile Picture
          </Typography>
          <label className="custom-file-upload">
            //icon einfügen Choose a picture
            <input
              style={{ display: "none" }}
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
            />
          </label>
          <div
            style={{
              width: "300px",
              height: "300px",
              overflow: "hidden",
            }}
          >
            {selectedImage && (
              <>
                <img
                  src={URL.createObjectURL(selectedImage)}
                  alt="Preview"
                  style={{
                    objectFit: "scale-down",
                    width: 300,
                    height: 300,
                  }}
                />
              </>
            )}
          </div>
          <Button onClick={handleUpload}>Upload</Button>
          {imageURL && <img src={imageURL} alt="Uploaded" />}
        </Box>
      </Modal>
    </>
  );
}
