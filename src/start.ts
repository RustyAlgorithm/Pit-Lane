/**
 * @file start.ts
 * @description Main application entry point for TanStack Start.
 * Initializes the app with error handling middleware and request processing.
 */

import { createStart, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";

/**
 * Error handling middleware for the entire application.
 * Catches and logs unhandled errors, returning a branded error page
 * for non-StatusCode errors, while allowing StatusCode errors to propagate.
 */
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Allow HTTP status errors to propagate
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Log and render error page for unexpected errors
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * TanStack Start instance with configured error handling middleware.
 * This instance handles all incoming requests and ensures errors are
 * properly captured and displayed to users.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
