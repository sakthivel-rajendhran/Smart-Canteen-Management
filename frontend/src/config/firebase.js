import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';

export const getEnvFirebaseConfig = () => {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const appId = String(import.meta.env.VITE_FIREBASE_APP_ID || '').trim();

  if (!apiKey || !authDomain || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    ...(appId ? { appId } : {}),
  };
};

export const getFirebaseAuthClient = (serverFirebaseConfig = null) => {
  const config = getEnvFirebaseConfig() || serverFirebaseConfig;
  if (!config?.apiKey || !config?.authDomain || !config?.projectId) {
    return null;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  return {
    auth,
    googleProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
  };
};

export const signOutFirebaseIfInitialized = async () => {
  try {
    if (getApps().length === 0) return;
    const auth = getAuth(getApp());
    await signOut(auth);
  } catch {
    // Best-effort Firebase client cleanup during logout
  }
};

