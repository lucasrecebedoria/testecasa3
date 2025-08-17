// Firebase v9 modular SDK via CDN
// Esse arquivo carrega e exporta as instâncias para uso no app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, addDoc, getDocs, collection, query, where, orderBy, limit, serverTimestamp, updateDoc, deleteDoc, Timestamp, startAt, endAt, startAfter
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtYzKI4ta7gzeqWxSQ6FMEu8A427islUQ",
  authDomain: "caixasv1.firebaseapp.com",
  projectId: "caixasv1",
  storageBucket: "caixasv1.firebasestorage.app",
  messagingSenderId: "545325374379",
  appId: "1:545325374379:web:6d422f3e9af5f195df10ee",
  measurementId: "G-8K54YESCGD"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// re-export helpers for convenience
export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
  doc, setDoc, getDoc, addDoc, getDocs, collection, query, where, orderBy, limit, serverTimestamp, updateDoc, deleteDoc, Timestamp, startAt, endAt, startAfter,
  storageRef, uploadBytes, getDownloadURL, deleteObject
};
