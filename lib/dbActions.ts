"use server";

import { adminDB } from "@/lib/firebase/server";
import { getUserFromCookie } from "@/lib/session";
import { z } from "zod";
import type { Place } from "@/lib/type";

export async function fetchPhotosInfo() {
  const photosCollection = await adminDB
    .collection("photos")
    .orderBy("date", "desc")
    .get();
  const photosPathList = await Promise.all(
    photosCollection.docs.map(async (photo: any) => {
      const id = photo.id;
      const photoData = photo.data();
      const userInfoMatchUid = await adminDB
        .collection("users")
        .doc(photoData.uid)
        .get();
      const nickName = userInfoMatchUid.data().settings.nickName;
      const currentDate = new Date();
      const postDate = photoData.date.toDate();

      const setPostDateString = (postDate: Date) => {
        const diffDate = currentDate.getTime() - postDate.getTime();
        if (diffDate < 3600000) {
          return `${Math.floor(diffDate / 60000)}分前`;
        } else if (diffDate < 86400000) {
          return `${Math.floor(diffDate / 3600000)}時間前`;
        } else if (diffDate < 604800000) {
          return `${Math.floor(diffDate / 86400000)}日前`;
        }
        return `${postDate.getFullYear()}年${postDate.getMonth()}月${postDate.getDate()}日`;
      };

      const postDateString = setPostDateString(postDate);

      return {
        id: id,
        nickName: nickName,
        fav: photoData.fav,
        url: photoData.url,
        place: photoData.place,
        postDate: postDateString,
      };
    })
  );
  return photosPathList;
}

export async function fetchLikesPhoto() {
  const user = await getUserFromCookie();
  if (!user) return null;
  const uid = user.uid;
  const userRef = await adminDB.collection("users").doc(uid).get();
  const likes = userRef.data().likes;
  return likes;
}

export async function patchUserLikesPhoto(likes: string[]) {
  const user = await getUserFromCookie();
  if (!user) return false;
  const uid = user.uid;
  await adminDB
    .collection("users")
    .doc(uid)
    .set({ likes: likes }, { merge: true })
    .catch((error: Error) => {
      return false;
    });
  return true;
}

export async function patchPhotoFavNum(photoId: string, newFavNum: number) {
  try {
    await adminDB.collection("photos").doc(photoId).update({ fav: newFavNum });
    return true;
  } catch (error) {
    return false;
  }
}

export async function postCollectionInLogs(
  title: string,
  place: string,
  state: string
) {
  const user = await getUserFromCookie();
  if (!user) throw new Error("ログインしてください");
  const uid = user.uid;
  const logData = {
    title: title,
    place: place,
    state: state,
    date: new Date(),
    uid: uid,
  };
  await adminDB
    .collection("logs")
    .add(logData)
    .catch((error: Error) => {
      throw new Error(error.message);
    });
}

export async function postUserInfo(uid: string, nickName: string) {
  const initialTimeTable: { [key: number]: boolean[] } = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [i, Array(3).fill(false)])
  );
  const userInfo = {
    checkinProgramIds: [],
    likes: [],
    createdAt: new Date(),
    reward: 0,
    currentPlace: "none",
    notification: {
      isNotify: false,
      id: "",
      createdAt: new Date(),
    },
    settings: {
      nickName: nickName,
      modeOfTransportation: "",
      timeTable: initialTimeTable,
    },
    dev: false,
    university: false,
    form: {
      1: false,
      2: false,
    },
  };
  await adminDB
    .collection("users")
    .doc(uid)
    .set(userInfo)
    .catch((error: Error) => {
      console.log(error);
    });
}

export async function postUserSettings(prevState: any, formData: FormData) {
  const user = await getUserFromCookie();
  if (!user) throw new Error("ログインしてください");
  const uid = user.uid;

  const schema = z.object({
    nickName: z.string().max(10, "ニックネームは10文字以内で入力してください"),
  });

  try {
    const { nickName } = schema.parse({
      nickName: formData.get("nickName"),
    } as z.infer<typeof schema>);

    const settings = {
      notification: formData.get("notification") === "true" ? true : false,
      nickName: nickName,
      modeOfTransportation:
        formData.get("modeOfTransportation")?.toString() || "",
      timeTable: JSON.parse(formData.get("timeTable") as string),
    };
    await adminDB
      .collection("users")
      .doc(uid)
      .set({ settings }, { merge: true });
    return {
      message: "success",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        message: error.issues[0].message,
      };
    }
    return {
      message: "パスワードが間違っているか、アカウントが存在しません",
    };
  }
}

export async function fetchUserSettings() {
  const user = await getUserFromCookie();
  if (!user) return null;
  const uid = user.uid;
  const userRef = await adminDB.collection("users").doc(uid).get();
  const settings = userRef.data().settings;

  const newSettings = settings as any;
  return newSettings;
}

export async function fetchQrInfo(qrId: string) {
  const qrRef = await adminDB.collection("QR").doc(qrId).get();
  const qrInfo = qrRef.data();
  return qrInfo;
}

export async function fetchProgramInfo(programId: string) {
  const programRef = await adminDB.collection("program").doc(programId).get();
  const programInfo = programRef.data();
  return programInfo;
}

export async function fetchReward() {
  const user = await getUserFromCookie();
  if (!user) return;
  const uid = user.uid;
  const userRef = await adminDB.collection("users").doc(uid).get();
  const currentReward = userRef.data().reward;
  return currentReward;
}

export async function patchReward(rewardPoint: string, rewardField?: string) {
  const user = await getUserFromCookie();
  if (!user) return;
  const uid = user.uid;
  try {
    const currentReward = await fetchReward();
    await adminDB
      .collection("users")
      .doc(uid)
      .set(
        {
          reward: currentReward + Number(rewardPoint),
          prevReward: currentReward,
        },
        { merge: true }
      );
  } catch (error) {
    console.log(error);
  }
}

export async function patchCheckinProgramIds(programId: string) {
  const user = await getUserFromCookie();
  if (!user) return;
  const uid = user.uid;
  try {
    const userRef = await adminDB.collection("users").doc(uid).get();
    const checkinProgramIds = userRef.data().checkinProgramIds || [];
    checkinProgramIds.push(programId);
    const newCheckinProgramIds = [...new Set(checkinProgramIds)];
    await adminDB
      .collection("users")
      .doc(uid)
      .set({ checkinProgramIds: newCheckinProgramIds }, { merge: true });
  } catch (error) {
    console.log(error);
  }
}

export async function patchCheckoutProgramIds(programId: string) {
  const user = await getUserFromCookie();
  if (!user) return;
  const uid = user.uid;
  try {
    const userRef = await adminDB.collection("users").doc(uid).get();
    const checkinProgramIds = userRef.data().checkinProgramIds || [];
    const newCheckinProgramIds = checkinProgramIds.filter(
      (id: string) => id !== programId
    );
    await adminDB
      .collection("users")
      .doc(uid)
      .set({ checkinProgramIds: newCheckinProgramIds }, { merge: true });
  } catch (error) {
    console.log(error);
  }
}

export async function fetchCheckinProgramIds() {
  const user = await getUserFromCookie();
  if (!user) return [];
  const uid = user.uid;
  try {
    const userRef = await adminDB.collection("users").doc(uid).get();
    const checkinProgramIds: any[] = userRef.data().checkinProgramIds || [];
    return checkinProgramIds;
  } catch (error) {
    console.log(error);
    throw new Error("プログラムの取得に失敗しました");
  }
}

export async function fetchAllOnlinePrograms() {
  try {
    const programRef = await adminDB
      .collection("program")
      .where("isOpen", "==", true)
      .get();
    const programList: any[] = programRef.docs.map((program: any) => {
      const programData = program.data();
      return programData;
    });
    return programList;
  } catch (error) {
    console.log(error);
    throw new Error("プログラムの取得に失敗しました");
  }
}

export async function postSignature(sign: string) {
  try {
    const signatureRef = await adminDB.collection("signature").add({
      sign: sign,
      date: new Date(),
    });
    return signatureRef.id;
  } catch (error) {
    console.log(error);
  }
}

export async function fetchPlace(docId?: string) {
  try {
    const placeRef = docId
      ? await adminDB.collection("place").doc(docId).get()
      : await adminDB.collection("place").get();
    const placeList = placeRef.docs.map((place: any) => {
      const placeData: Place = place.data();
      return placeData;
    });
    return placeList;
  } catch (error) {
    console.log(error);
  }
}

export async function fetchMode(uid: string) {
  try {
    const modeRef = await adminDB.collection("mode").doc("mode").get();
    const modeDev = modeRef.data().dev;
    const userRef = await adminDB.collection("users").doc(uid).get();
    const userMode = userRef.data().dev;
    return {
      webMode: modeDev,
      userMode: userMode,
    };
  } catch (error) {
    console.log(error);
  }
}
