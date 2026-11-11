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

export const getFirebaseAuthClient = async (serverFirebaseConfig = null) => {
  const config = getEnvFirebaseConfig() || serverFirebaseConfig;
  if (!config?.apiKey || !config?.authDomain || !config?.projectId) {
    return null;
  }

  const [{ initializeApp, getApps, getApp }, authMod] = await Promise.all([
    import('@firebase/app'),
    import('@firebase/auth'),
  ]);

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = authMod.getAuth(app);
  const googleProvider = new authMod.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  return {
    auth,
    googleProvider,
    signInWithPopup: authMod.signInWithPopup,
    signInWithRedirect: authMod.signInWithRedirect,
    getRedirectResult: authMod.getRedirectResult,
    signOut: authMod.signOut,
  };
};

export const signOutFirebaseIfInitialized = async () => {
  try {
    const [{ getApps, getApp }, { getAuth, signOut }] = await Promise.all([
      import('@firebase/app'),
      import('@firebase/auth'),
    ]);
    if (getApps().length === 0) return;
    const auth = getAuth(getApp());
    await signOut(auth);
  } catch {
    // Best-effort Firebase client cleanup during logout
  }
};
