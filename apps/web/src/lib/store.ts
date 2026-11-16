"use client";
/** On-device storage (IndexedDB) for scans and field surveys. Nothing leaves the device. */
import { createStore, del, entries, get, set, clear } from "idb-keyval";
import type { CropId } from "@/lib/diseases";

export type Scan = {
  id: string;
  at: number;
  classId: string;
  confidence: number;
  supported: boolean;
  probs: { id: string; p: number }[];
  thumb: string; // data URL
  note?: string;
  modelVersion: string;
  surveyId?: string;
  geo?: { lat: number; lon: number };
};

export type Survey = {
  id: string;
  at: number;
  name: string;
  crop: CropId;
  scanIds: string[];
  geo?: { lat: number; lon: number };
  done: boolean;
};

const scans = typeof indexedDB !== "undefined" ? createStore("leafcheckup", "scans") : undefined;
const surveys = typeof indexedDB !== "undefined" ? createStore("leafcheckup-surveys", "surveys") : undefined;

export const uid = () => crypto.randomUUID();

export async function saveScan(s: Scan) { await set(s.id, s, scans); }
export async function getScan(id: string) { return get<Scan>(id, scans); }
export async function deleteScan(id: string) { await del(id, scans); }
export async function listScans(): Promise<Scan[]> {
  return ((await entries<string, Scan>(scans)).map(([, v]) => v)).sort((a, b) => b.at - a.at);
}
export async function clearScans() { await clear(scans); }

export async function saveSurvey(s: Survey) { await set(s.id, s, surveys); }
export async function getSurvey(id: string) { return get<Survey>(id, surveys); }
export async function deleteSurvey(id: string) { await del(id, surveys); }
export async function listSurveys(): Promise<Survey[]> {
  return ((await entries<string, Survey>(surveys)).map(([, v]) => v)).sort((a, b) => b.at - a.at);
}

export async function exportAll() {
  return JSON.stringify({ format: "leafcheckup-export", version: 1, exportedAt: new Date().toISOString(), scans: await listScans(), surveys: await listSurveys() });
}

export async function importAll(json: string) {
  const data = JSON.parse(json);
  if (data?.format !== "leafcheckup-export" || !Array.isArray(data.scans)) throw new Error("Not a LeafCheckup export file");
  let n = 0;
  for (const s of data.scans as Scan[]) {
    if (typeof s.id === "string" && typeof s.classId === "string" && typeof s.thumb === "string" && s.thumb.startsWith("data:image/")) {
      await saveScan(s);
      n++;
    }
  }
  for (const s of (data.surveys ?? []) as Survey[]) if (typeof s.id === "string" && Array.isArray(s.scanIds)) await saveSurvey(s);
  return n;
}
