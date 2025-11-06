"use client"

import { Search, Upload, BarChart3, Bug } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar"



const menuItems = [
  {
    title: "Dashboard",
    description: "Overview and statistics",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Search",
    description: "Search and analyze data",
    url: "/",
    icon: Search,
  },
  {
    title: "Upload",
    description: "Upload and process files",
    url: "/upload",
    icon: Upload,
  },
  {
    title: "Debug ZIP",
    description: "Debug ZIP files",
    url: "/debug-zip",
    icon: Bug,
  },
]

export function AppSidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [logoSrc, setLogoSrc] = React.useState("/images/logo.png");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted) {
      const timestamp = new Date().getTime();
      const logo = resolvedTheme === 'light' ? "/images/logo-light.png" : "/images/logo.png";
      setLogoSrc(`${logo}?t=${timestamp}`);
    }
  }, [mounted, resolvedTheme]);

  return (
    <Sidebar className="bg-bron-bg-secondary border-r border-bron-border">
      <SidebarHeader className="bg-bron-bg-secondary border-b border-bron-border !p-6">
        <div className="flex flex-col items-center">
          <img
            src={logoSrc}
            alt="broń Vault Logo"
            className="h-10 w-auto mb-2"
          />
          <p className="text-xs text-bron-text-muted leading-tight text-center">
            Where stolen data meets structured investigation.
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-bron-bg-secondary flex flex-col h-full">
        <SidebarGroup className="!p-4">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0 space-y-[8px]">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className={`
                      h-auto flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors
                      ${pathname === item.url 
                        ? "!bg-red-500/10 dark:!bg-red-500/20 !text-bron-text-primary" 
                        : "text-bron-text-muted hover:text-bron-text-primary hover:bg-bron-bg-tertiary"
                      }
                    `}
                  >
                    <Link href={item.url} className="flex items-center space-x-2 w-full">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-[11px] text-bron-text-muted">{item.description}</div>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="flex-1" />
        <div className="p-4 border-t border-bron-border flex items-center justify-between">
          <span className="text-xs flex items-center gap-2" style={{ color: 'var(--bron-text-muted)' }}>
            <Sun className="h-4 w-4" style={{ color: 'var(--bron-accent-yellow)' }} />
            Light
          </span>
          {mounted && (
            <Switch
              checked={resolvedTheme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              aria-label="Toggle theme"
              className="data-[state=checked]:bg-[var(--bron-accent-red)] bg-[var(--bron-bg-tertiary)] border-[var(--bron-border)]
                [&>span]:bg-[var(--bron-text-primary)]"
            />
          )}
          <span className="text-xs flex items-center gap-2" style={{ color: 'var(--bron-text-muted)' }}>
            <Moon className="h-4 w-4" style={{ color: 'var(--bron-accent-blue)' }} />
            Dark
          </span>
        </div>

      </SidebarContent>
    </Sidebar>
  )
}
