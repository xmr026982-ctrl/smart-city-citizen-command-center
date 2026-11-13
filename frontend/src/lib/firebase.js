/* ------------------------------------------------------------------
   Google sign-in (citizens only), through Firebase.

   Needs, once:   npm install firebase
   and in frontend/.env (never committed; see .env.example):
     VITE_FIREBASE_API_KEY=
     VITE_FIREBASE_AUTH_DOMAIN=
     VITE_FIREBASE_PROJECT_ID=
     VITE_FIREBASE_APP_ID=

   These four are Firebase's public web settings: Firebase is designed
   for them to be in the page. What keeps Google sign-in safe is on the
   server: the backend checks the Google token with its own private
   service key (backend only, never here), and Firebase only accepts
   sign-ins from the domains listed in its console.

   Firebase loads only when someone presses "Continue with Google", so
   the rest of the site never waits for it.
------------------------------------------------------------------- */
const env = import.meta.env || {};

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** Google sign-in is offered only when the four settings are present */
export const GOOGLE_ON = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let ready = null;
async function firebase() {
  if (!ready) {
    ready = Promise.all([import("firebase/app"), import("firebase/auth")]).then(([appMod, authMod]) => {
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config);
      return { auth: authMod.getAuth(app), authMod };
    });
  }
  return ready;
}

const GOOGLE_ERRORS = {
  "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
  "auth/cancelled-popup-request": "Google sign-in was closed before it finished.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/unauthorized-domain": "Google sign-in isn't enabled for this web address yet. Please use email and password.",
  "auth/network-request-failed": "Can't reach Google right now. Check your connection and try again.",
};

/** Opens Google's account picker. Returns Google's ID token for the server to verify. */
export async function googleIdToken() {
  if (!GOOGLE_ON) throw new Error("Google sign-in isn't available right now.");
  const { auth, authMod } = await firebase();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await authMod.signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    const email = result.user.email || "";
    // the app keeps the server's session, not Firebase's
    authMod.signOut(auth).catch(() => {});
    return { idToken, email };
  } catch (err) {
    throw new Error(GOOGLE_ERRORS[err?.code] || "Google sign-in didn't finish. Please try again.");
  }
}
