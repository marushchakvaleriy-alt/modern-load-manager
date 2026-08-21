import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from './src/lib/firebase.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

getDocs(collection(db, 'projects')).then(snap => {
  let dates = snap.docs.map(d => d.data().importedAt).filter(Boolean).sort().reverse();
  console.log('Latest importedAt:', dates[0]);
  process.exit(0);
});
