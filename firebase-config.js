import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbPn22AKMtKvc6OYIH5hESKnWcBhFDcnE",
  authDomain: "legadobateas.firebaseapp.com",
  databaseURL: "https://legadobateas-default-rtdb.firebaseio.com",
  projectId: "legadobateas",
  storageBucket: "legadobateas.firebasestorage.app",
  messagingSenderId: "1015641940440",
  appId: "1:1015641940440:web:e1c84e721372cd0238d2ad"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);