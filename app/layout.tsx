import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import ClientLayoutWithSidebar from "@/components/client-layout-with-sidebar"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
})

export const metadata: Metadata = {
  title: "broń Vault",
  description: "Where stolen data meets structured investigation.",
  generator: 'broń Vault Dashboard'
}

// Initialize cron jobs in production
// if (process.env.NODE_ENV === "production") {
//   import("@/lib/cron-jobs").then(({ startVulnerabilityUpdateCron, startCleanupCron }) => {
//     startVulnerabilityUpdateCron()
//     startCleanupCron()
//   })
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/favicon.png" />
      </head>
      <body className={`${inter.className} bg-background text-foreground`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function applyThemeVariables(theme) {
                  const lightThemeVars = {
                    '--background': '0 0% 97%',
                    '--foreground': '0 0% 13%',
                    '--card': '0 0% 95%',
                    '--card-foreground': '0 0% 13%',
                    '--popover': '0 0% 95%',
                    '--popover-foreground': '0 0% 13%',
                    '--primary': '4 100% 45%',
                    '--primary-foreground': '0 0% 100%',
                    '--secondary': '0 0% 93%',
                    '--secondary-foreground': '0 0% 13%',
                    '--muted': '0 0% 93%',
                    '--muted-foreground': '0 0% 60%',
                    '--accent': '4 100% 45%',
                    '--accent-foreground': '0 0% 100%',
                    '--destructive': '4 100% 45%',
                    '--destructive-foreground': '0 0% 100%',
                    '--border': '0 0% 90%',
                    '--input': '0 0% 90%',
                    '--ring': '4 100% 45%',
                    '--sidebar-background': '0 0% 95%',
                    '--sidebar-foreground': '0 0% 13%',
                    '--sidebar-primary': '4 100% 45%',
                    '--sidebar-primary-foreground': '0 0% 100%',
                    '--sidebar-accent': '0 0% 93%',
                    '--sidebar-accent-foreground': '0 0% 13%',
                    '--sidebar-border': '0 0% 90%',
                    '--sidebar-ring': '4 100% 45%'
                  };

                  const darkThemeVars = {
                    '--background': '210 11% 8%',
                    '--foreground': '0 0% 100%',
                    '--card': '210 11% 12%',
                    '--card-foreground': '0 0% 100%',
                    '--popover': '210 11% 12%',
                    '--popover-foreground': '0 0% 100%',
                    '--primary': '4 100% 45%',
                    '--primary-foreground': '0 0% 100%',
                    '--secondary': '210 11% 16%',
                    '--secondary-foreground': '0 0% 100%',
                    '--muted': '210 11% 16%',
                    '--muted-foreground': '0 0% 70%',
                    '--accent': '4 100% 45%',
                    '--accent-foreground': '0 0% 100%',
                    '--destructive': '4 100% 45%',
                    '--destructive-foreground': '0 0% 100%',
                    '--border': '210 11% 25%',
                    '--input': '210 11% 25%',
                    '--ring': '4 100% 45%',
                    '--sidebar-background': '210 11% 12%',
                    '--sidebar-foreground': '0 0% 100%',
                    '--sidebar-primary': '4 100% 45%',
                    '--sidebar-primary-foreground': '0 0% 100%',
                    '--sidebar-accent': '210 11% 16%',
                    '--sidebar-accent-foreground': '0 0% 100%',
                    '--sidebar-border': '210 11% 25%',
                    '--sidebar-ring': '4 100% 45%'
                  };

                  const vars = theme === 'light' ? lightThemeVars : darkThemeVars;
                  Object.entries(vars).forEach(([prop, value]) => {
                    document.documentElement.style.setProperty(prop, value);
                  });
                }

                // Apply theme on load
                const observer = new MutationObserver(() => {
                  const theme = document.documentElement.getAttribute('data-theme');
                  if (theme) {
                    applyThemeVariables(theme);
                  }
                });

                observer.observe(document.documentElement, {
                  attributes: true,
                  attributeFilter: ['data-theme']
                });

                // Apply initial theme
                const initialTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                applyThemeVariables(initialTheme);
              })();
            `,
          }}
        />
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem>
        <SidebarProvider>
          <ClientLayoutWithSidebar>{children}</ClientLayoutWithSidebar>
        </SidebarProvider>
        <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
