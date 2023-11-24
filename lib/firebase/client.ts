import { initializeApp, getApps, getApp, FirebaseError } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { session, sessionLogout } from "../session";
import { redirect, useRouter } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_APIKEY,
  authDomain: process.env.NEXT_PUBLIC_AUTHDOMAIN,
  projectId: process.env.NEXT_PUBLIC_PROJECTID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGEBUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGINGSENDERID,
  appId: process.env.NEXT_PUBLIC_APPID,
};

function createFirebaseApp(firebaseConfig: object) {
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  } else {
    return getApp();
  }
}

export const app = createFirebaseApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

const analyticsMock = {
  logEvent: () => {},
  setCurrentScreen: () => {},
  setUserId: () => {},
};

// export const analytics =
//   typeof window !== undefined ? getAnalytics(app) : undefined;

export async function createUser(prevState: any, formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const id = await userCredential.user.getIdToken();
    await session(id);
  } catch (error) {
    return {
      message: "すでに登録済みかパスワードが間違っています",
    };
  }
  return redirect("/test");
}

export async function login(prevState: any, formData: FormData) {
  noStore();
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const id = await userCredential.user.getIdToken();
    await session(id);
  } catch (error) {
    return {
      message: "パスワードが間違っているか、アカウントが存在しません",
    };
  }
  return redirect("/test");
}

export async function logout() {
  try {
    await signOut(auth);
    await sessionLogout();
    return redirect("/login");
  } catch (error) {
    if (error instanceof FirebaseError) {
      return {
        message: error.message,
      };
    }
  }
}

export function getCurrentUser() {
  noStore();
  return auth.currentUser;
}
