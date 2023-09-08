import { useState, useEffect } from "react";
import {
  createUserDocumentFromAuth,
  db,
  loadFriends,
  onAuthStateChangedListener,
} from "./../../utils/firebase";
import {
  setCurrentUser,
  setFriends,
  setJoinDate,
  setUserData,
  setUserId,
} from "./../../app/slices/user-slice";
import ConversationLoader from "./../../logic/loading-components/conversation-loader";
import { AppUser, CurrentUser, Friend } from "./../../logic/types/user.types";
import FriendLoader from "./../../logic/loading-components/friend-loader";
import { useAppDispatch, useAppSelector } from "./../../app/hooks";
import {
  addCategory,
  addVocab,
  addWorkbook,
  changeCurLang,
  changeNativeLang,
} from "../../app/slices/vocabs-slice";
import {
  getAllVocsDb,
  loadLastUpdated,
  updateLastUpdated,
} from "../../utils/firebase/firebase-vocab";
import { AllVocabsClass, Vocab } from "../classes/vocab.class";
import { VocObj, WorkbookType } from "../types/vocab.types";
import { setAllVocabs } from "../../app/slices/vocabs-class-slice";

const LoadingContainer = () => {
  const {
    currentUser,
    conversations,
    friends,
    friendsSet,
    id: uid,
  } = useAppSelector((state) => state.user);
  const { unreadMsgs } = useAppSelector((state) => state.conversations);
  const [loading, setLoading] = useState(true);
  const [friendLoads, setFriendLoads] = useState<Friend[]>([]);
  const [conversationLoads, setConversationLoads] = useState<string[]>([]);
  const dispatch = useAppDispatch();
  const { lastUpdate, workbooks, categories } = useAppSelector((s) => s.vocabs);

  useEffect(() => {
    if (unreadMsgs > 0) document.title = `(${unreadMsgs}) VoChat`;
    else document.title = "VoChat";
  }, [unreadMsgs]);

  useEffect(() => {
    if (window.location.href.includes("signup")) return;
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (user) {
        createUserDocumentFromAuth(user);
      }

      if (!user) return;
      const currentUser: CurrentUser = {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        providerData: {
          providerId: user.providerData[0].providerId,
          uid: user.providerData[0].uid,
          displayName: user.providerData[0].displayName,
          email: user.providerData[0].email,
          phoneNumber: user.providerData[0].phoneNumber,
          photoURL: user.providerData[0].photoURL,
        },
        stsTokenManager: {
          refreshToken: user.refreshToken,
          accessToken: "afd",
          expirationTime: 13242,
        },
      };
      dispatch(setJoinDate(Number(user.metadata.creationTime)));
      dispatch(setCurrentUser(currentUser));
      if (user?.uid) dispatch(setUserId(user.uid));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const getFriends = async () => {
      const data = await loadFriends(currentUser.uid);
      if (!data) return;
      const friends = data.friends;

      // for later: checken wann "last active war und gegebenenfalls nicht updaten"
      const lastActive = Date.now();
      const userData: AppUser = {
        name: data.displayName,
        email: data.email,
        lastActive,
        createdAt: data.createdAt.seconds,
        conversations: data.conversations,
        teachLanguages: data.teachLanguages,
        learnLanguages: data.learnLanguages,
        deletedFriends: data?.deletedFriends || [],
        addedDataVocsRefs: {},
        imageURL: data.imageURL || null,
      };

      dispatch(setFriends(friends));
      dispatch(setUserData(userData));
      if (data.currentLang) dispatch(changeCurLang(data.currentLang));
      if (data.nativeLang) dispatch(changeNativeLang(data.nativeLang));
    };
    getFriends();
  }, [currentUser]);

  const activityUpdater = async () => {
    await updateLastUpdated(uid, lastUpdate);
  };

  useEffect(() => {
    activityUpdater();
  }, [lastUpdate]);

  const loadVocabs = async () => {
    const updated = await loadLastUpdated(uid);
    if (updated === lastUpdate) return;
    try {
      const vocs: VocObj[] = await getAllVocsDb(uid);

      const newAllVocabs = new AllVocabsClass([]);
      if (vocs.length < 1) return;
      console.log(vocs);
      const wbs: WorkbookType[] = [];
      const cats: string[] = [];
      const wbIds: string[] = workbooks.map((wb) => wb.id);
      vocs.forEach((voc) => {
        if (!voc.workbooks) return;
        newAllVocabs.addVocab(new Vocab(voc));
        voc.workbooks.forEach((wb) => {
          if (!wbIds.includes(wb.id)) {
            wbIds.push(wb.id);
            wbs.push(wb);
          }
        });
        voc.categories.forEach((cat) => {
          if (!categories.includes(cat) && !cats.includes(cat)) cats.push(cat);
        });
        dispatch(addVocab(voc));
      });
      wbs.forEach((wb) => dispatch(addWorkbook(wb)));
      cats.forEach((cat) => dispatch(addCategory({ label: cat })));
      dispatch(setAllVocabs(newAllVocabs));
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    loadVocabs();
  }, []);

  useEffect(() => {
    setLoading(true);
    if (friends.length > -1 && conversations.length > 0) setLoading(false);
    if (conversations.length !== conversationLoads.length)
      setConversationLoads([...conversations]);
    if (friends.length !== friendLoads.length) {
      setFriendLoads([...friends]);
    }
  }, [friends, conversations]);
  return (
    <>
      {!loading &&
        friendsSet &&
        friendLoads.map((friend) => (
          <FriendLoader key={friend.id} friend={friend} />
        ))}
      {!loading &&
        friendsSet &&
        conversationLoads.map((conv) => (
          <ConversationLoader key={conv} conversation={conv} />
        ))}
    </>
  );
};

export default LoadingContainer;
