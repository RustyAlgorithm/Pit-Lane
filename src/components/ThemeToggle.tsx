import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={label}
            className="border-border/70 bg-background/80 backdrop-blur"
            suppressHydrationWarning
          >
            <span suppressHydrationWarning>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
