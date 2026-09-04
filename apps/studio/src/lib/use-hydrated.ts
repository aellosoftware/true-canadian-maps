"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
// Server-rendered forms must not submit until their client handler is attached.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
