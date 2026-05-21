/**
 * @file __root.tsx
 * @description Root route component for the application.
 * Sets up the app shell with theming, error handling, and global context providers.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/SiteHeader";
import Banner from "@/components/Banner";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { getThemeInitScript } from "@/lib/theme";

/**
 * Error page component displayed when a route doesn't exist (404).
 * Shows a friendly 404 message with navigation options.
 */
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Error page component displayed when an error occurs during rendering.
 * Shows error message with options to retry or return home.
 */
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Root route configuration.
 * Provides QueryClient context to all routes and defines error/not-found handlers.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pit Lane" },
      { name: "description", content: "Diecast Racing App" },
      { name: "author", content: "RustyAlley" },
      { property: "og:title", content: "Pit Lane" },
      { property: "og:description", content: "Diecast Racing App" },
      { property: "og:type", content: "website" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Root shell component rendered on the server.
 * Sets up the HTML structure with theme initialization script.
 */
function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronous theme setup script prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Root component with global providers.
 * Wraps the app with QueryClientProvider and ThemeProvider for state management.
 */
function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppFrame />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Main app frame with layout.
 * Contains site header, banner, and route outlet.
 */
function AppFrame() {
  const { resolvedTheme } = useTheme();

  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        {/* Top navigation bar */}
        <SiteHeader />
        
        {/* Info banner with beta notice */}
        <Banner 
          type="info"
          message="Welcome to the Open Beta - Please feel free to use the feedback link at the top of the page."
        />
        
        {/* Page content from current route */}
        <Outlet />
      </div>
      
      {/* Toast notification system */}
      <Toaster richColors position="top-center" theme={resolvedTheme} />
    </>
  );
}
