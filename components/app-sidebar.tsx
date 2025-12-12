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
        title: "Asset Discovery",
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
    <Sidebar className="border-r border-white/5 bg-sidebar/80 backdrop-blur-xl transition-all duration-300">
      <SidebarHeader className="border-b border-white/5 p-6 pb-8">
        <div className="flex flex-col items-center">
          <div className="relative mb-2">
            <div className="absolute -inset-1 rounded-full bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <img
              src={logoSrc}
              alt="broń Vault Logo"
              className="relative h-10 w-auto"
            />
          </div>
          <p className="text-[11px] tracking-widest text-muted-foreground leading-tight text-center font-medium mt-2">
            Where stolen data meets structured investigation.
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex flex-col h-full px-2 py-4">
        <div className="flex-1 overflow-auto space-y-4">
          {menuGroups.map((group) => (
            <SidebarGroup key={group.title} className="bg-transparent p-0">
              <SidebarGroupLabel className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isMenuItemActive(item.url)}
                        className={`
                          group relative w-full overflow-hidden rounded-xl px-4 py-2.5 transition-all duration-300
                          ${isMenuItemActive(item.url)
                            ? "bg-primary/10 text-primary shadow-[0_0_20px_-5px_rgba(230,27,0,0.3)]"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }
                        `}
                      >
                        <Link href={item.url} className="flex items-center space-x-3 w-full relative z-10">
                          <item.icon className={`h-5 w-5 transition-transform duration-300 ${isMenuItemActive(item.url) ? 'scale-110' : 'group-hover:scale-110'}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium tracking-wide ${isMenuItemActive(item.url) ? 'font-semibold' : ''}`}>{item.title}</div>
                            {/* <div className="text-[10px] opacity-70 truncate">{item.description}</div> */}
                          </div>
                          {isMenuItemActive(item.url) && (
                            <div className="absolute right-0 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_2px_rgba(230,27,0,0.5)] animate-pulse" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>

        <div className="mt-auto px-4 py-4 border-t border-white/5">
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-1 backdrop-blur-sm border border-white/5">
            <div className="flex items-center gap-2 px-2">
              <Sun className="h-3 w-3 text-amber-500" />
            </div>
            {mounted && (
              <Switch
                checked={resolvedTheme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                aria-label="Toggle theme"
                className="scale-75 data-[state=checked]:bg-primary bg-muted"
              />
            )}
            <div className="flex items-center gap-2 px-2">
              <Moon className="h-3 w-3 text-blue-500" />
            </div>
          </div>
        </div>

      </SidebarContent>
    </Sidebar>
  )
}
