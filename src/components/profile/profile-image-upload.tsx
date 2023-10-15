import { Modal, Box, Typography, Button } from "@mui/material";
import * as React from "react";
import { styled } from "@mui/material/styles";
import FolderIcon from "@mui/icons-material/Folder";
import PictureUploadButton from "./upload-button";
import { useAppSelector } from "../../app/hooks";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

export default function ProfileImageUpload({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (val: boolean) => void;
}) {
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const { id: uid } = useAppSelector((s) => s.user);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files || [];
    if (file.length > 0) {
      setSelectedImage(file[0]);
    }
  };

  const handleClose = () => setOpen(false);

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
          <Typography
            textAlign="center"
            id="modal-modal-title"
            variant="h5"
            component="h2"
          >
            Select a Profile Picture
          </Typography>

          <Box
            display="flex"
            flexDirection="column"
            p={1}
            justifyContent="center"
            alignItems="center"
          >
            <Button
              component="label"
              sx={{ mx: "auto" }}
              startIcon={<FolderIcon />}
            >
              Search Picture
              <VisuallyHiddenInput
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
              />
            </Button>
            <div
              style={{
                width: "300px",
                height: "300px",
                overflow: "hidden",
                outlineStyle: "auto",
                marginTop: 10,
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

            <PictureUploadButton selectedImage={selectedImage} uid={uid} />
          </Box>
        </Box>
      </Modal>
    </>
  );
}
