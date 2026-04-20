import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'ADMIN' | 'DIRIGENTE' | 'PUBLICADOR';
  masterUid?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ensure user document exists
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        let profileData: UserProfile;

        if (!userSnap.exists()) {
          // Check for invite/share link
          const urlParams = new URLSearchParams(window.location.search);
          const shareId = urlParams.get('share');
          
          let role: 'ADMIN' | 'DIRIGENTE' | 'PUBLICADOR' = 'ADMIN';
          let masterUid = undefined;

          if (shareId) {
            try {
              const shareDoc = await getDoc(doc(db, 'shares', shareId));
              if (shareDoc.exists() && shareDoc.data().ownerUid) {
                 masterUid = shareDoc.data().ownerUid;
                 role = 'PUBLICADOR';
              }
            } catch (err) {
              console.error("Error resolving share link:", err);
            }
          }

          profileData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            role,
            masterUid
          };

          const emptyDb = { bairros: [], chats: [] };
          await setDoc(userRef, {
            ...profileData,
            database: JSON.stringify(emptyDb)
          });
        } else {
          const data = userSnap.data();
          profileData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            role: data.role || 'ADMIN',
            masterUid: data.masterUid
          };
          
          // Migrate old accounts to have a role
          if (!data.role) {
            await setDoc(userRef, { role: 'ADMIN' }, { merge: true });
          }
        }
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
