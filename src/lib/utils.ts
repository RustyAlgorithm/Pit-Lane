/**
 * @file utils.ts
 * @description Core utility functions for the application.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS class names.
 * Combines clsx (conditional class names) with twMerge (Tailwind conflict resolution).
 * This allows safe merging of Tailwind classes while respecting specificity rules.
 * 
 * @param inputs - CSS class values (strings, objects, arrays, etc.)
 * @returns Merged and deduplicated CSS class string
 * 
 * @example
 * cn('px-2 py-1', { 'flex': true }, 'px-4') // Returns: 'py-1 px-4 flex'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
