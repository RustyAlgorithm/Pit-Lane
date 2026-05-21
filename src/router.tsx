/**
 * @file router.tsx
 * @description Router configuration for the application.
 * Sets up TanStack Router with all routes and provides the query client context.
 */

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Factory function to create and configure the application router.
 * 
 * @returns A configured TanStack Router instance with:
 * - Generated route tree from file-based routing
 * - QueryClient for data fetching and caching
 * - Scroll restoration on navigation
 * - Default preload stale time of 0ms (immediate preloading)
 */
export const getRouter = () => {
  // Create QueryClient for React Query (data fetching, caching, synchronization)
  const queryClient = new QueryClient();

  // Configure and create the router
  const router = createRouter({
    routeTree,                           // File-based routing structure
    context: { queryClient },             // Provide queryClient to all routes
    scrollRestoration: true,              // Restore scroll position on navigation
    defaultPreloadStaleTime: 0,          // Preload routes immediately when stale
  });

  return router;
};
