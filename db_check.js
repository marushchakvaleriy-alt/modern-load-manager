import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [k, v] = line.split('=');
    env[k.trim()] = v.trim();
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

getDocs(collection(db, 'projects')).then(snap => {
  console.log('Total DB projects:', snap.docs.length);
  snap.docs.slice(0, 5).forEach(d => {
    console.log(d.id, d.data().department, d.data().importedAt);
  });
  process.exit(0);
});
