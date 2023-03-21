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
} from "firebase/firestore";
import { Conversation } from "../logic/classes/conversation.class";
import { Message } from "../logic/types/message.types";
import { Contact, Friend } from "../logic/types/user.types";
import { VocObj } from "../logic/types/vocab.types";

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
  additionalInformation = {}
) => {
  if (!userAuth) return;

  const userDocRef = doc(db, "users", userAuth.uid);

  const userSnapshot = await getDoc(userDocRef);

  if (!userSnapshot.exists()) {
    const { displayName, email, uid } = userAuth;
    const lastActive = new Date();
    const createdAt = new Date();
    const conversations: string[] = [];
    const teachLanguages: string[] = [];
    const learnLanguages: string[] = [];
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
        ...additionalInformation,
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

export const sendNewMessage = async (convId: string, msg: Message) => {
  const convRef = doc(db, "conversations", convId);
  await updateDoc(convRef, {
    messages: arrayUnion(msg),
    lastInteraction: Date.now(),
  });
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
