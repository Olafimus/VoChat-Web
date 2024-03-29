import { doc } from "firebase/firestore";
import React, { useEffect } from "react";
import { useDocument } from "react-firebase-hooks/firestore";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setFriends, setUserData } from "../../app/slices/user-slice";
import { db } from "../../utils/firebase";
import { AppUser } from "../types/user.types";
import {
  loadLastUpdated,
  updateLastUpdated,
} from "../../utils/firebase/firebase-vocab";

const UserDataLoader: React.FC<{ id: string }> = ({ id }) => {
  const dispatch = useAppDispatch();
  const [value, loading, error] = useDocument(doc(db, "users", id), {
    snapshotListenOptions: { includeMetadataChanges: true },
  });

  useEffect(() => {
    // console.log("fired")
    if (!value) return;
    const data = value.data();
    if (!data) return;
    const friends = data.friends;
    const userData: AppUser = {
      name: data.displayName,
      email: data.email,
      lastActive: Date.now(),
      createdAt: data.createdAt.seconds,
      conversations: data.conversations,
      teachLanguages: data.teachLanguages,
      learnLanguages: data.learnLanguages,
      addedDataVocsRefs: data.addedDataVocsRefs,
      deletedFriends: data?.deletedFriends || [],
      imageURL: data.imageURL || null,
    };

    dispatch(setFriends(friends));
    dispatch(setUserData(userData));
  }, [value]);

  return <div style={{ display: "none" }}>UserDataLoader</div>;
};

export default UserDataLoader;
