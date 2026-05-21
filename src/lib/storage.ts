/**
 * @file storage.ts
 * @description Storage utilities and ID generation for local data persistence.
 * Provides React hooks and utilities for managing data in browser localStorage.
 */

import { useEffect, useState, useCallback } from "react";

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
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, hydrated]);

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