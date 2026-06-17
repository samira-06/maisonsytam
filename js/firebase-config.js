// Firebase Configuration — Remplis avec les credentials de ton projet Firebase
// Crée un projet sur https://console.firebase.google.com/
// Active Firestore, Storage, Authentication (Email/Password)

const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "ton-projet.firebaseapp.com",
  projectId: "ton-projet",
  storageBucket: "ton-projet.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxx",
};

// Flag : vrai si la config Firebase est remplie
const FIREBASE_READY = FIREBASE_CONFIG.apiKey !== "AIzaSy...";
