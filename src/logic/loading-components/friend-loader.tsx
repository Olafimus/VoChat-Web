import { doc } from "firebase/firestore";
import React, { useEffect } from "react";
import { useDocument } from "react-firebase-hooks/firestore";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { changeFriendName } from "../../app/slices/user-slice";
import { db } from "../../utils/firebase";
import { Friend } from "../types/user.types";

const FriendLoader: React.FC<{ friend: Friend }> = ({ friend }) => {
  const { friends } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  const [value, loading, error] = useDocument(doc(db, "users", friend.id), {
    snapshotListenOptions: { includeMetadataChanges: true },
  });

  useEffect(() => {
    if (!value) return;
    const data = {
      name: value.data()?.displayName ?? "",
    };
    // if ((friend.name = data.name)) return;
    const payload = {
      frId: friend.id,
      name: data.name,
    };

    dispatch(changeFriendName(payload));
  }, [value]);
  return <></>;
};

export default FriendLoader;
