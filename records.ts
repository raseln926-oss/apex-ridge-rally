import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { RaceMode, RaceResultSnapshot } from './types';

export interface DriverProfileData {
  uid: string;
  driverName: string;
  racesCompleted: number;
  bestLapMs: number;
  topSpeedKmh: number;
}

export interface StageRecordData {
  id: string;
  ownerUid: string;
  driverName: string;
  mode: RaceMode;
  totalLaps: number;
  position: number;
  totalTimeMs: number;
  bestLapMs: number;
  topSpeedKmh: number;
  createdAtMs: number;
}

export function sanitizeDriverName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Apex Driver';
  return trimmed.slice(0, 40);
}

export function buildValidatedStagePayload(
  uid: string,
  rawName: string | null | undefined,
  result: RaceResultSnapshot
) {
  const driverName = sanitizeDriverName(rawName);
  const mode: RaceMode = result.mode === 'time_trial' ? 'time_trial' : 'race';
  const totalLaps = result.totalLaps === 3 ? 3 : 2;
  const position = Math.max(1, Math.min(3, Math.round(result.position)));
  const totalTimeMs = Math.max(1000, Math.min(3600000, Math.round(result.totalTimeMs)));
  const bestLapRaw = result.bestLapMs ?? Math.round(totalTimeMs / totalLaps);
  const bestLapMs = Math.max(1000, Math.min(1800000, Math.round(bestLapRaw)));
  const topSpeedKmh = Math.max(1, Math.min(400, Math.round(result.topSpeedKmh)));

  return {
    ownerUid: uid,
    driverName,
    mode,
    totalLaps,
    position,
    totalTimeMs,
    bestLapMs,
    topSpeedKmh,
  };
}

export async function saveStageResultToFirestore(
  user: User,
  result: RaceResultSnapshot
): Promise<void> {
  const payload = buildValidatedStagePayload(user.uid, user.displayName, result);

  // 1. Create StageRecord document
  const recordsPath = 'stageRecords';
  try {
    await addDoc(collection(db, recordsPath), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, recordsPath);
  }

  // 2. Upsert DriverProfile document
  const driverPath = `drivers/${user.uid}`;
  const driverRef = doc(db, 'drivers', user.uid);
  let existingSnap;
  try {
    existingSnap = await getDoc(driverRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, driverPath);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(driverRef, {
        uid: user.uid,
        driverName: payload.driverName,
        racesCompleted: 1,
        bestLapMs: payload.bestLapMs,
        topSpeedKmh: payload.topSpeedKmh,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, driverPath);
    }
  } else {
    const prev = existingSnap.data() as Partial<DriverProfileData>;
    const prevBestLap = typeof prev.bestLapMs === 'number' && prev.bestLapMs > 0 ? prev.bestLapMs : payload.bestLapMs;
    const prevTopSpeed = typeof prev.topSpeedKmh === 'number' ? prev.topSpeedKmh : 0;
    const prevRaces = typeof prev.racesCompleted === 'number' ? prev.racesCompleted : 0;

    try {
      await updateDoc(driverRef, {
        driverName: payload.driverName,
        racesCompleted: Math.min(1000000, prevRaces + 1),
        bestLapMs: Math.min(prevBestLap, payload.bestLapMs),
        topSpeedKmh: Math.min(400, Math.max(prevTopSpeed, payload.topSpeedKmh)),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, driverPath);
    }
  }
}

export function subscribeDriverProfile(
  uid: string,
  onData: (profile: DriverProfileData | null) => void,
  onError: (err: Error) => void
): () => void {
  const path = `drivers/${uid}`;
  return onSnapshot(
    doc(db, 'drivers', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid: String(d.uid ?? uid),
        driverName: sanitizeDriverName(d.driverName),
        racesCompleted: Number(d.racesCompleted ?? 0),
        bestLapMs: Number(d.bestLapMs ?? 0),
        topSpeedKmh: Number(d.topSpeedKmh ?? 0),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeRecentStageRecords(
  uid: string,
  onData: (records: StageRecordData[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'stageRecords';
  const q = query(
    collection(db, path),
    where('ownerUid', '==', uid),
    limit(20)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: StageRecordData[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt as Timestamp | undefined;
        return {
          id: docSnap.id,
          ownerUid: String(d.ownerUid ?? uid),
          driverName: sanitizeDriverName(d.driverName),
          mode: d.mode === 'time_trial' ? 'time_trial' : 'race',
          totalLaps: Number(d.totalLaps ?? 2),
          position: Number(d.position ?? 1),
          totalTimeMs: Number(d.totalTimeMs ?? 0),
          bestLapMs: Number(d.bestLapMs ?? 0),
          topSpeedKmh: Number(d.topSpeedKmh ?? 0),
          createdAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0,
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items.slice(0, 5));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function deleteStageRecord(recordId: string): Promise<void> {
  const path = `stageRecords/${recordId}`;
  try {
    await deleteDoc(doc(db, 'stageRecords', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
