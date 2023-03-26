import React from "react";
import { useAppSelector } from "../../app/hooks";

const DeleteFriend = () => {
  const { friends } = useAppSelector((state) => state.user);
  return (
    <div>
      <div style={{ height: "5rem" }}></div>
      {friends.map((fr) => {
        return (
          <div>
            <p>{fr.name}</p>
            <button>Delete</button>
          </div>
        );
      })}
    </div>
  );
};

export default DeleteFriend;
