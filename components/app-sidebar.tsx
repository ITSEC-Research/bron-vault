"use client"

import { Search, Upload, BarChart3, Bug, Globe, Settings, Users, LucideIcon, Key, BookOpen, ClipboardList, FileUp, Radio, Rss, ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import React from "react"
import { useAuth, isAdmin } from "@/hooks/useAuth"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
} from "@/components/ui/sidebar"

interface MenuItem {
  title: string
  description: string
  url: string
  icon: LucideIcon
  adminOnly?: boolean // Optional flag to restrict to admin only
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
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
        adminOnly: true, // Only admins can upload data
      },
      {
        title: "Import Logs",
        description: "View Import History",
        url: "/import-logs",
        icon: FileUp,
        adminOnly: true, // Only admins can view import logs
      },
      {
        title: "Debug ZIP",
        description: "Validate ZIP Files",
        url: "/debug-zip",
        icon: Bug,
        adminOnly: true, // Only admins can debug uploads
      },
    ],
  },
  {
    title: "Monitoring",
    items: [
      {
        title: "Domain Monitor",
        description: "Webhook Alerts",
        url: "/monitoring",
        icon: Radio,
        adminOnly: true,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Users",
        description: "Manage User Accounts",
        url: "/users",
        icon: Users,
        adminOnly: true, // Only admins can manage users
      },
      {
        title: "API Keys",
        description: "Manage API Access",
        url: "/api-keys",
        icon: Key,
      },
      {
        title: "API Docs",
        description: "API Documentation",
        url: "/docs",
        icon: BookOpen,
      },
      {
        title: "Audit Logs",
        description: "View Activity Logs",
        url: "/audit-logs",
        icon: ClipboardList,
        adminOnly: true, // Only admins can view audit logs
      },
      {
        title: "Settings",
        description: "Configure System",
        url: "/settings",
        icon: Settings,
        adminOnly: true, // Only admins can access settings
      },
    ],
  },
]

interface AppSidebarProps {
  initialUserRole?: string | null;
}

export function AppSidebar({ initialUserRole }: AppSidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [logoSrc, setLogoSrc] = React.useState("/images/logo.png");
  
  // Get user role for menu filtering
  const { user } = useAuth(false) // Don't require auth here, just get user if available
  // Use auth API result when available, fall back to server-provided cookie hint for initial render.
  // This eliminates the 2-step menu flash: SSR HTML already contains correct menu items.
  const userIsAdmin = user ? isAdmin(user) : initialUserRole === 'admin'
  const [feedCategories, setFeedCategories] = React.useState<{ name: string; slug: string }[]>([])
  const feedsOpen = pathname.startsWith('/feeds')

  // Helper function to check if menu item is active
  // For /domain-search, also match sub-routes like /domain-search/[domain]
  const isMenuItemActive = (url: string) => {
    if (pathname === url) return true;

    // Match dynamic feeds
    if (url.startsWith("/feeds/") && pathname.startsWith(url)) {
      return true;
    }
    
    // For /domain-search, also match sub-routes
    if (url === "/domain-search") {
      return pathname.startsWith("/domain-search/");
    }

    // For /monitoring, also match sub-routes
    if (url === "/monitoring") {
      return pathname.startsWith("/monitoring/");
    }

    return false;
  };

  React.useEffect(() => {
    setMounted(true);

    fetch("/api/feeds/categories")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.categories && data.categories.length > 0) {
          setFeedCategories(data.categories)
        }
      })
      .catch(err => console.error("Failed to load feed categories for sidebar", err))
  }, []);

  React.useEffect(() => {
    if (mounted) {
      const timestamp = new Date().getTime();
      const logo = resolvedTheme === 'light' ? "/images/logo-light.png" : "/images/logo.png";
      setLogoSrc(`${logo}?t=${timestamp}`);
    }
  }, [mounted, resolvedTheme]);

  const filteredMenuGroups = menuGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.adminOnly || userIsAdmin)
    }))
    .filter(group => group.items.length > 0) // Remove empty groups

  return (
    <Sidebar className="border-r-[2px] border-border bg-sidebar/80 backdrop-blur-xl transition-all duration-300">
      <SidebarHeader className="border-b-[2px] border-border p-6 pb-8">
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
          {filteredMenuGroups.map((group) => (
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
                          group relative w-full overflow-hidden rounded-xl px-4 py-1.5 transition-all duration-300 h-auto min-h-8
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

          {/* News Feed — Collapsible nested menu */}
          <SidebarGroup className="bg-transparent p-0">
            <SidebarGroupLabel className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
              News Feed
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                <Collapsible defaultOpen={feedsOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={`
                          group relative w-full overflow-hidden rounded-xl px-4 py-1.5 transition-all duration-300 h-auto min-h-8
                          ${feedsOpen
                            ? "bg-primary/10 text-primary shadow-[0_0_20px_-5px_rgba(230,27,0,0.3)]"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }
                        `}
                      >
                        <Rss className={`h-5 w-5 transition-transform duration-300 ${feedsOpen ? 'scale-110' : 'group-hover:scale-110'}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium tracking-wide ${feedsOpen ? 'font-semibold' : ''}`}>Feeds</div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="mt-2">
                        {/* All Feeds */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === '/feeds/all'}
                            className={`
                              rounded-lg px-3 py-1 transition-all duration-200
                              ${pathname === '/feeds/all'
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                              }
                            `}
                          >
                            <Link href="/feeds/all">
                              <span>All Feeds</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {/* Dynamic categories */}
                        {feedCategories.map(cat => (
                          <SidebarMenuSubItem key={cat.slug}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === `/feeds/${cat.slug}`}
                              className={`
                                rounded-lg px-3 py-1 transition-all duration-200
                                ${pathname === `/feeds/${cat.slug}`
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                                }
                              `}
                            >
                              <Link href={`/feeds/${cat.slug}`}>
                                <span>{cat.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        <div className="mt-auto px-4 py-4 border-t-[2px] border-border">
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
