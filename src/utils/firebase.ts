import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithRedirect,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  NextOrObserver,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  getDocs,
  collection,
  addDoc,
  arrayRemove,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Conversation } from "../logic/classes/conversation.class";
import { Message } from "../logic/types/message.types";
import { Contact, Friend } from "../logic/types/user.types";
import { VocObj } from "../logic/types/vocab.types";
import { Response } from "../components/chat/message-box";

const firebaseConfig = {
  apiKey: "AIzaSyDJ4oBGl3SRrN0uAV6mVjk7Ka7ICE7xW7g",
  authDomain: "vocab-app-3c50a.firebaseapp.com",
  projectId: "vocab-app-3c50a",
  storageBucket: "vocab-app-3c50a.appspot.com",
  messagingSenderId: "911931013688",
  appId: "1:911931013688:web:590a6bae6da0bdf6be44cd",
  measurementId: "G-DPNE3539TN",
  databaseURL: "https://vocab-app-3c50a-default-rtdb.firebaseio.com/",
};

const firebaseApp = initializeApp(firebaseConfig);
export const storage = getStorage();

export const uploadFile = async (file: File, uid: string) => {
  const path = `user-images/${uid}`;
  const storageRef = ref(storage, path);
  try {
    await uploadBytes(storageRef, file);
    const userDocRef = doc(db, "users", uid);
    const url = await loadUserImage(uid);
    console.log(url);
    updateDoc(userDocRef, { imageURL: url });
  } catch (error) {
    // throw new Error(error.message as string);
    console.log(error);
  }
};

export const loadUserImage = async (uid: string) => {
  const url = await getDownloadURL(ref(storage, `user-images/${uid}`));
  return url;
};

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export const auth = getAuth();
export const signInWithGooglePopup = () =>
  signInWithPopup(auth, googleProvider);
export const signInWithGoogleRedirect = () =>
  signInWithRedirect(auth, googleProvider);

export const db = getFirestore();

export const createUserDocumentFromAuth = async (
  userAuth: User,
  displayName?: string,
  currentLang?: string,
  nativeLang?: string,
  teachLanguages?: string[],
  learnLanguages?: string[]
) => {
  if (!userAuth) return;

  const userDocRef = doc(db, "users", userAuth.uid);

  const userSnapshot = await getDoc(userDocRef);

  if (!userSnapshot.exists()) {
    const { email, uid } = userAuth;
    const lastActive = Date.now();
    const createdAt = Date.now();
    const conversations: string[] = [];

    const friends: Friend[] = [];
    const allVocabs: VocObj[] = [];

    try {
      await setDoc(userDocRef, {
        name: displayName,
        email,
        id: uid,
        lastActive,
        createdAt,
        conversations,
        teachLanguages,
        learnLanguages,
        friends,
        allVocabs,
        currentLang,
        nativeLang,
        displayName,
      });
    } catch (error) {
      console.log("error creating the user", error);
    }
  }

  return userDocRef;
};

export const createAuthUserWithEmailAndPassword = async (
  email: string,
  password: string
) => {
  if (!email || !password) return;

  return await createUserWithEmailAndPassword(auth, email, password);
};

export const signInAuthUserWithEmailAndPassword = async (
  email: string,
  password: string
) => {
  if (!email || !password) return;

  return await signInWithEmailAndPassword(auth, email, password);
};

export const signOutUser = async () => await signOut(auth);

export const onAuthStateChangedListener = (callback: NextOrObserver<User>) =>
  onAuthStateChanged(auth, callback);

export const loadFriends = async (uid: string) => {
  const userDocRef = doc(db, "users", uid);
  const dc = await getDoc(userDocRef);
  return dc.data();
};

export const addFriendToDb = async (uid: string, friend: Friend) => {
  const userDocRef = doc(db, "users", uid);
  const data = await getDoc(userDocRef);
  if (!data.data()) return;
  const frIdArr: string[] = [];
  data?.data()?.friends.forEach((fr: Friend) => frIdArr.push(fr.id));
  if (frIdArr.includes(friend.id)) return;
  updateDoc(userDocRef, { friends: arrayUnion(friend) });
};
export const reAddFriendToDb = async (
  uid: string,
  friend: Friend,
  deletedFriends: Friend[]
) => {
  const userDocRef = doc(db, "users", uid);
  const convRef = doc(db, "conversations", friend.conversation);

  updateDoc(userDocRef, {
    friends: arrayUnion(friend),
    deletedFriends,
    conversations: arrayUnion(friend.conversation),
  });
  const snap = await getDoc(convRef);
  const delUser: { user: string; time: number }[] = snap.data()?.leftUsers;
  if (!delUser) return;
  const leftUsers = delUser.filter((el) => el.user !== uid);
  updateDoc(convRef, {
    leftUsers,
  });
};

export const deleteContact = async (
  uid: string,
  friend: Friend,
  newFriends: Friend[],
  convId: string,
  multiChat = false
) => {
  const userDocRef = doc(db, "users", uid);
  const conversationDocRef = doc(db, "conversations", convId);

  // friends hier filtern
  await updateDoc(userDocRef, {
    friends: newFriends,
    deletedFriends: arrayUnion(friend),
    conversations: arrayRemove(convId),
    leftConversations: arrayUnion({ id: convId, contact: friend.id }),
  });

  await updateDoc(conversationDocRef, {
    leftUsers: arrayUnion({ user: uid, time: Date.now() }),
    inactive: !multiChat,
  });
};

export const usersCollectionRef = collection(db, "users");

export const getUsers = async () => {
  const data = await getDocs(usersCollectionRef);
  return data.docs.map((doc) => ({
    id: doc.data().id,
    name: doc.data().displayName,
    email: doc.data().email,
  }));
};

export const getContactData = async (contact: string) => {
  const userDocRef = doc(db, "users", contact);
  const data = await getDoc(userDocRef);
  if (!data.data()) return;
  const friend = {
    name: data.data()?.displayName,
    id: data.data()?.id,
  };
  return friend;
};

export const loadConversation = async (id: string) => {
  const conversationDocRef = doc(db, "conversations", id);
  const d = await getDoc(conversationDocRef);
  const conversation = {
    users: d.data()?.users,
    languages: d.data()?.languages,
    messages: d.data()?.messages,
    corrections: d.data()?.corrections,
    vocabs: d.data()?.vocabs,
  };
};

const convCollectionRef = collection(db, "conversations");

export const setConvDoc = async (conv: Conversation) => {
  await setDoc(doc(db, "conversations", conv.id), conv);
};

export const addConvToFriend = async (
  friendId: string,
  userId: string,
  convId: string
) => {
  const friendRef = doc(db, "users", friendId);
  const userRef = doc(db, "users", userId);
  await updateDoc(friendRef, { conversations: arrayUnion(convId) });
  await updateDoc(userRef, { conversations: arrayUnion(convId) });
};

export const updateFriendsData = async (uid: string, friends: Friend[]) => {
  const userDocRef = doc(db, "users", uid);
  updateDoc(userDocRef, { friends: friends });
};

export const getUserData = async (uid: string) => {
  const userDocRef = doc(db, "users", uid);
  const data = await getDoc(userDocRef);
  return data;
};

export const sendResponse = async (
  convId: string,
  msgId: string,
  response: Response
) => {
  const convRef = doc(db, "conversations", convId);
  const data = await getDoc(convRef);
  const messages = data.data()?.messages;
  if (!messages) return;
  const msg = messages.find((el: Message) => el.id === msgId);
  msg.response = response;
  await updateDoc(convRef, {
    messages,
    lastInteraction: Date.now(),
  });
};

export const sendSharedWb = async (id: string, vocabs: VocObj[]) => {
  await setDoc(doc(db, "sharedWorkbooks", id), { vocabs });
};

export const getSharedWb = async (id: string) => {
  const wbRef = doc(db, "sharedWorkbooks", id);
  const data = await getDoc(wbRef);
  const vocs = data.data()?.vocabs;

  return vocs;
};

export const checkConvInDb = () => {};

// "Langzeitspeiche" für jede Conversation
// Document "oldmessages"
// im Conversationsdocument "longtermref: string" Feld einfügen

//longtermn dann für alle 300 Nachrichten ein neues Feld " 1: (Arr mit 300 Nachrichten), 2: (Arr mir 300 Nachrichten)"
// in Conversation Document dann einen Marker bei welcher Zahl mit aktuell ist: "longTermCount: 3

export const setLongTermRef = async (convId: string) => {
  await setDoc(doc(db, "oldmessages", convId), { 1: [] });
};

export const sendNewMessage = async (convId: string, msg: Message) => {
  const convRef = doc(db, "conversations", convId);
  const longRef = doc(db, "oldmessages", "LT" + convId);
  const d = await getDoc(convRef);
  const messages = d.data()?.messages || null;

  if (messages.length > 250) {
    const oldMsgs = messages.splice(0, 200);
    console.log("msgs", oldMsgs);
    messages.push(msg);
    if (!d.data()?.longTermRef) {
      await setLongTermRef("LT" + convId);
      await updateDoc(convRef, {
        longTermRef: "LT" + convId,
        longTermCount: 1,
      });
    }
    const count = d.data()?.longTermCount || 1;
    let archCount = d.data()?.messageArchiveCount || 1;
    const oldDoc = await getDoc(longRef);
    const oldData = oldDoc.data() || {};
    const keys = Object.keys(oldData);
    if (keys.length > 15) {
      const archRef = `AR${archCount}${convId}`;
      await setDoc(doc(db, "messageArchive", archRef), {
        messages: oldData,
      });
      archCount = archCount + 1;
      const deleteObj: { [key: string]: "deleteField()" } = {};
      keys.forEach((key) => (deleteObj[key] = "deleteField()"));
      await setDoc(longRef, { [count]: oldMsgs });
    } else {
      await updateDoc(longRef, {
        [count]: oldMsgs,
      });
    }
    await updateDoc(convRef, {
      messages,
      longTermCount: count + 1,
      messageArchiveCount: archCount,
      lastInteraction: Date.now(),
    });
  } else {
    await updateDoc(convRef, {
      messages: arrayUnion(msg),
      lastInteraction: Date.now(),
    });
  }
};

type OldMessage = { [key: string]: Message[] };

export const getOldMessages = async (id: string) => {
  const msgRef = doc(db, "oldmessages", id);
  const d = await getDoc(msgRef);
  const msgs = d.data() as OldMessage;
  return msgs;
};

export const changeDbLangs = async (
  uid: string,
  currentLang: string,
  nativeLang: string,
  teachLanguages: string[],
  learnLanguages: string[]
) => {
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    currentLang,
    nativeLang,
    teachLanguages,
    learnLanguages,
  });
};
