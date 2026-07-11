/**
 * @file storage.ts
 * @description Storage utilities and ID generation for local data persistence.
 * Provides React hooks and utilities for managing data in browser localStorage.
 */

import { useEffect, useState, useCallback } from "react";

/**
 * Custom event fired when a useLocalStorage hook writes to a key. Other
 * useLocalStorage instances bound to the same key listen for this event so
 * that data changes made in one component (e.g. the ServerSync mirror)
 * propagate to every consumer in the same tab. The native `storage` event
 * only fires across tabs, which is why we need this custom bridge.
 */
const CROSS_HOOK_EVENT = "pitlane:storage";

/**
 * React hook for managing data in browser localStorage with React state synchronization.
 * Automatically loads initial value from localStorage on mount and persists changes.
 * Safely handles serialization/deserialization of JSON data.
 * 
 * @template T The type of data being stored
 * @param key The localStorage key to use
 * @param initial The initial value if nothing is in localStorage
 * @returns A tuple containing:
 *   - value: Current stored value
 *   - update: Function to update the value (accepts value or updater function)
 *   - hydrated: Boolean indicating if data has been loaded from localStorage
 * 
 * @example
 * const [cars, setCars, hydrated] = useLocalStorage('cars', []);
 * useEffect(() => {
 *   if (hydrated) {
 *     // Cars data is now loaded from localStorage
 *   }
 * }, [hydrated]);
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, [key]);

  // Persist to localStorage whenever value changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const serialized = JSON.stringify(value);
      const existing = localStorage.getItem(key);
      if (existing !== serialized) {
        localStorage.setItem(key, serialized);
        // Notify other useLocalStorage instances in this tab.
        window.dispatchEvent(new CustomEvent(CROSS_HOOK_EVENT, { detail: { key } }));
      }
    } catch {}
  }, [key, value, hydrated]);

  // Listen for cross-hook changes (same tab) and cross-tab storage events.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reload = () => {
      try {
        const raw = localStorage.getItem(key);
        setValue(raw ? (JSON.parse(raw) as T) : initial);
      } catch {}
    };
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail && detail.key === key) reload();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) reload();
    };
    window.addEventListener(CROSS_HOOK_EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CROSS_HOOK_EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
    // `initial` is intentionally captured once — a value reset when storage
    // is cleared falls back to the initial the caller supplied on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Update handler supporting both direct values and updater functions
  const update = useCallback((updater: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater));
  }, []);

  return [value, update, hydrated] as const;
}

/**
 * Generate a unique identifier for new database records.
 * Combines random characters with current timestamp for uniqueness and sortability.
 * 
 * @returns A unique ID string (8 random chars + 4 timestamp chars = 12 chars total)
 * 
 * @example
 * const carId = uid(); // Returns something like: 'a1b2c3d4xyz'
 */
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);