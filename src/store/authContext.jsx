import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { AuthContext } from './authContextObject';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setRole(userDoc.data().role || 'viewer');
        } else {
          setRole('viewer');
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const register = async ({ firstName, lastName, email, password }) => {
    const existingUsersSnapshot = await getDocs(collection(db, 'users'));
    const isFirstUser = existingUsersSnapshot.empty;

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const normalizedFirstName = String(firstName || '').trim();
    const normalizedLastName = String(lastName || '').trim();
    const assignedRole = isFirstUser ? 'admin' : 'viewer';

    await setDoc(doc(db, 'users', credential.user.uid), {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      fullName: [normalizedFirstName, normalizedLastName].filter(Boolean).join(' '),
      email: credential.user.email,
      role: assignedRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    return credential;
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, role, loading, login, register, logout, isFirebaseConfigured }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
