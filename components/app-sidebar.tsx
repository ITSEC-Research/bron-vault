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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar"



const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Search",
    url: "/",
    icon: Search,
  },
  {
    title: "Upload",
    url: "/upload",
    icon: Upload,
  },
  {
    title: "Debug ZIP",
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
      <SidebarHeader className="bg-bron-bg-secondary">
        <div className="px-2 py-4 flex flex-col items-center">
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-bron-text-muted">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className={`
                      text-bron-text-muted hover:text-bron-text-primary hover:bg-bron-bg-tertiary
                      ${pathname === item.url ? "bg-bron-accent-red text-bron-text-primary" : ""}
                    `}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
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
