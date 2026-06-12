// Shared Firebase setup for Tailsandtoys.
// Loaded after the firebase-*-compat.js SDK scripts, so the global
// `firebase` namespace is available here. Exposes `db` (Firestore) and
// `auth` (Authentication) as globals for script.js / admin.html to use.

const firebaseConfig = {
  apiKey: "AIzaSyDLIQg32Tu8ogP596ylyiCB-x3dAugmLZk",
  authDomain: "tailsandtoys.firebaseapp.com",
  projectId: "tailsandtoys",
  storageBucket: "tailsandtoys.firebasestorage.app",
  messagingSenderId: "456224841104",
  appId: "1:456224841104:web:ae4c00d95e1e3ce566e715",
  measurementId: "G-L8TZNQVDLF"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
