import type React from "react"
import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import ClientLayoutWithSidebar from "@/components/client-layout-with-sidebar"
import { Toaster } from "@/components/ui/toaster"
// Setup global error handlers early (server-side only)
if (typeof window === 'undefined') {
  require("@/lib/error-handler")
}

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
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
      <body className={`${inter.variable} ${outfit.variable} font-sans bg-background text-foreground antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function applyThemeVariables(theme) {
                  const lightThemeVars = {
                    '--background': '0 0% 99%',
                    '--foreground': '0 0% 10%',
                    '--card': '0 0% 100%',
                    '--card-foreground': '0 0% 10%',
                    '--popover': '0 0% 100%',
                    '--popover-foreground': '0 0% 10%',
                    '--primary': '3 100% 55%',
                    '--primary-foreground': '0 0% 100%',
                    '--secondary': '0 0% 95%',
                    '--secondary-foreground': '0 0% 10%',
                    '--muted': '0 0% 95%',
                    '--muted-foreground': '0 0% 45%',
                    '--accent': '3 100% 55%',
                    '--accent-foreground': '0 0% 100%',
                    '--destructive': '0 84% 60%',
                    '--destructive-foreground': '0 0% 98%',
                    '--border': '0 0% 90%',
                    '--input': '0 0% 90%',
                    '--ring': '3 100% 55%',
                    '--sidebar-background': '0 0% 98%',
                    '--sidebar-foreground': '0 0% 10%',
                    '--sidebar-primary': '3 100% 55%',
                    '--sidebar-primary-foreground': '0 0% 100%',
                    '--sidebar-accent': '0 0% 94%',
                    '--sidebar-accent-foreground': '0 0% 10%',
                    '--sidebar-border': '0 0% 90%',
                    '--sidebar-ring': '3 100% 55%'
                  };

                  const darkThemeVars = {
                    '--background': '0 0% 4%',
                    '--foreground': '0 0% 98%',
                    '--card': '0 0% 7%',
                    '--card-foreground': '0 0% 98%',
                    '--popover': '0 0% 7%',
                    '--popover-foreground': '0 0% 98%',
                    '--primary': '3 100% 60%',
                    '--primary-foreground': '0 0% 100%',
                    '--secondary': '0 0% 12%',
                    '--secondary-foreground': '0 0% 98%',
                    '--muted': '0 0% 12%',
                    '--muted-foreground': '0 0% 60%',
                    '--accent': '3 100% 60%',
                    '--accent-foreground': '0 0% 100%',
                    '--destructive': '0 84% 60%',
                    '--destructive-foreground': '0 0% 98%',
                    '--border': '0 0% 16%',
                    '--input': '0 0% 16%',
                    '--ring': '3 100% 60%',
                    '--sidebar-background': '0 0% 5%',
                    '--sidebar-foreground': '0 0% 98%',
                    '--sidebar-primary': '3 100% 60%',
                    '--sidebar-primary-foreground': '0 0% 100%',
                    '--sidebar-accent': '0 0% 12%',
                    '--sidebar-accent-foreground': '0 0% 98%',
                    '--sidebar-border': '0 0% 12%',
                    '--sidebar-ring': '3 100% 60%'
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
