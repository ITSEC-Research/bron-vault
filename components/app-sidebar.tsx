"use client"

import { Search, Upload, BarChart3, Bug, Globe, Settings } from "lucide-react"
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



const menuGroups = [
  {
    title: "Home",
    items: [
      {
        title: "Dashboard",
        description: "Overview & Statistics",
        url: "/dashboard",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "Discovery",
    items: [
      {
        title: "Search",
        description: "Search & Analyze Data",
        url: "/",
        icon: Search,
      },
      {
        title: "Domain Search",
        description: "Explore Footprint",
        url: "/domain-search",
        icon: Globe,
      },
    ],
  },
  {
    title: "Import",
    items: [
      {
        title: "Upload",
        description: "Upload & Process Files",
        url: "/upload",
        icon: Upload,
      },
      {
        title: "Debug ZIP",
        description: "Validate ZIP Files",
        url: "/debug-zip",
        icon: Bug,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Settings",
        description: "Configure System",
        url: "/settings",
        icon: Settings,
      },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [logoSrc, setLogoSrc] = React.useState("/images/logo.png");

  // Helper function to check if menu item is active
  // For /domain-search, also match sub-routes like /domain-search/[domain]
  const isMenuItemActive = (url: string) => {
    if (pathname === url) return true;
    
    // For /domain-search, also match sub-routes
    if (url === "/domain-search") {
      return pathname.startsWith("/domain-search/");
    }
    
    return false;
  };

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
        <div className="flex-1 overflow-auto space-y-0 p-4">
          {menuGroups.map((group) => (
            <SidebarGroup key={group.title} className="mb-[2px]">
              <SidebarGroupLabel className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-bron-text-muted">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0 space-y-[2px]">
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isMenuItemActive(item.url)}
                        className={`
                          h-auto flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors
                          ${isMenuItemActive(item.url)
                            ? "!bg-red-500/10 dark:!bg-red-500/20 !text-bron-text-primary" 
                            : "text-bron-text-secondary hover:text-bron-text-primary hover:bg-bron-bg-tertiary"
                          }
                        `}
                      >
                        <Link href={item.url} className="flex items-center space-x-2 w-full">
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-bron-text-secondary">{item.title}</div>
                            <div className="text-[10px] text-bron-text-muted">{item.description}</div>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>
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
