import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC9l5itSZ1d82v0co-LA64-hQOqnzoIPA8",
  authDomain: "quan-ly-quan-an-64116.firebaseapp.com",
  projectId: "quan-ly-quan-an-64116",
  storageBucket: "quan-ly-quan-an-64116.firebasestorage.app",
  messagingSenderId: "645355077336",
  appId: "1:645355077336:web:c0a94715815bd923d521ad"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
