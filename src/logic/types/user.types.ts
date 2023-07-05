import { VocObj } from "./vocab.types";

export type AppUser = {
  name: string;
  email: string;
  id?: string;
  lastActive: number;
  createdAt: number;
  conversations: string[];
  teachLanguages: string[];
  learnLanguages: string[];
  friends?: Friend[];
  deletedFriends?: Friend[];
  allVocabs: VocObj[];
};

export type OnlineUser = {
  id: string;
  name: string;
  email: string;
};

export type Friend = {
  id: string;
  lastInteraction: number;
  conversation: string;
  name?: string;
  lastMessage: string;
};

export type Contact = Friend & {
  name: string;
  lastMessage: string;
};

// type CurrentUser = {
//   uid: "RSPY2Vg81JU4BUYOXFz33WLaPTm2";
//   email: "test@test.de";
//   emailVerified: false;
//   isAnonymous: false;
//   providerData: {
//     providerId: "password";
//     uid: "test@test.de";
//     displayName: null;
//     email: "test@test.de";
//     phoneNumber: null;
//     photoURL: null;
//   };
//   stsTokenManager: {
//     refreshToken: "APJWN8dqOj01BJpHTXEplTM7MFEO-zwfxI2RuEjztIZQ2XYSYTjZaZodnE632oq4nr8Erixfk8uU0LOF7QBZesPvAphdveam5V9QwHTbM14KnA4d2JKSdFZ1aaKQHtetmidov3QkKk0Z4Z5C1reJK3OQbjLWXmKRWFV0qr0umYXfJCGMjfQMMDbJvEeayT1Y18Mly73dbksP4-A0JeBrG-NRrF1TGyiPzQ";
//     accessToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOTczZWUwZTE2ZjdlZWY0ZjkyMWQ1MGRjNjFkNzBiMmVmZWZjMTkiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdm9jYWItYXBwLTNjNTBhIiwiYXVkIjoidm9jYWItYXBwLTNjNTBhIiwiYXV0aF90aW1lIjoxNjc5NDA2MDA4LCJ1c2VyX2lkIjoiUlNQWTJWZzgxSlU0QlVZT1hGejMzV0xhUFRtMiIsInN1YiI6IlJTUFkyVmc4MUpVNEJVWU9YRnozM1dMYVBUbTIiLCJpYXQiOjE2Nzk0MDkzMTAsImV4cCI6MTY3OTQxMjkxMCwiZW1haWwiOiJ0ZXN0QHRlc3QuZGUiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdEB0ZXN0LmRlIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.VLcJAtZvfT_aM9lLfs2jNdyeP5r5DR9ieoYfKW8quqJBK47udhQmy-qo8ozIxXooBx3T-YjKl7lRv12aVfX_ZhZ1ENalb6bh1TWShjhddkKfkIxDPZqpHySAnVtwMzv8BDT7MoiN_fx1vr-7nfWo2r88DhRtfISHnPaJj3DI0ZGoqQTr5chQ1oUnPK1GJgibFSNR0Pt5QJSfQ29-XQFet194VymmoThFnGYoIpte_ikTaGrs5pMh5XTyNBwJiRev7EH3HCg7AWBjbL_K5UZChBM21clPlZe7jJNuTGFGyMe2X38XlfdGaQ4OS9lxcIJiYnSfCmjrTo0B71U40xg0ig";
//     expirationTime: 1679412909519;
//   };
//   createdAt: "1679179285423";
//   lastLoginAt: "1679406008910";
//   apiKey: "AIzaSyDJ4oBGl3SRrN0uAV6mVjk7Ka7ICE7xW7g";
//   appName: "[DEFAULT]";
// };

export type CurrentUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: {
    providerId: string;
    uid: string;
    displayName: null | string;
    email: string | null;
    phoneNumber: null | string;
    photoURL: null | string;
  };
  stsTokenManager: {
    refreshToken: string;
    accessToken: string;
    expirationTime: number;
  };
  createdAt?: number;
  lastLoginAt?: number;
  apiKey?: string;
  appName?: string;
};
