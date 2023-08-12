import { doc } from "firebase/firestore";
import React, { useEffect } from "react";
import { useDocument } from "react-firebase-hooks/firestore";
import { useAppDispatch } from "../../app/hooks";
import { setFriends, setUserData } from "../../app/slices/user-slice";
import { db } from "../../utils/firebase";
import { AppUser } from "../types/user.types";

const UserDataLoader: React.FC<{ id: string }> = ({ id }) => {
  const dispatch = useAppDispatch();
  const [value, loading, error] = useDocument(doc(db, "users", id), {
    snapshotListenOptions: { includeMetadataChanges: true },
  });

  useEffect(() => {
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
      allVocabs: data.allVocabs,
      deletedFriends: data?.deletedFriends || [],
    };
    console.log("userdata: ", userData.deletedFriends);
    dispatch(setFriends(friends));
    dispatch(setUserData(userData));
  }, [value]);

  return <div style={{ display: "none" }}>UserDataLoader</div>;
};

export default UserDataLoader;
