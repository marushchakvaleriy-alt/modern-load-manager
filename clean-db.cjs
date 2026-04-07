const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "demo",
  projectId: "demo"
};
// Use mock to protect actual data if we don't have node creds, wait actually we can just use the user UI.
