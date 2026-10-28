// components/system-admin/SystemAdminNav.jsx
//
// One row: brand · main pages · "More" (less-used pages) · screenshot · account menu.
// Brand and the right side share the spare width equally, so the page links sit centred.
// On small screens the page links collapse into a single "Menu" dropdown.

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  TrendingUp,
  AlertTriangle,
  Users,
  Lock,
  LogOut,
  Headset,
  UserCog,
  ShieldCheck,
  KeyRound,
  ChevronDown,
  Menu,
  Database,
  ScrollText,
  Server,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ScreenshotButton from "./ScreenshotButton";
import TokenDialog from "./TokenDialog";
import { useSystemAdmin } from "./SystemAdminContext";
import { systemAdminFetch, clearSystemAdminToken, SYSTEM_ADMIN_LOGIN } from "@/lib/systemAdminFetch";

const primaryItems = [
  { href: "/system-admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/system-admin/users", label: "Users", icon: Users },
  { href: "/system-admin/security", label: "Security", icon: Lock },
  { href: "/system-admin/bbuddy", label: "B. Buddy", icon: Headset },
];

// Less-used pages, tucked under More
const moreItems = [
  { href: "/system-admin/performance", label: "Performance", icon: TrendingUp },
  { href: "/system-admin/errors", label: "Errors", icon: AlertTriangle },
  { href: "/system-admin/database", label: "Database", icon: Database },
  { href: "/system-admin/requests", label: "Request logs", icon: ScrollText },
  { href: "/system-admin/server", label: "Live Server", icon: Server },
];

const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const linkClass = (active) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
    active
      ? "bg-orange-50 text-orange-600"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
  }`;

export default function SystemAdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin } = useSystemAdmin();
  const [tokenOpen, setTokenOpen] = useState(false);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = moreItems.some((i) => isActive(i.href));

  // Sends the Bearer token so the server can end this admin's sessions in every browser
  const handleLogout = async () => {
    try {
      await systemAdminFetch("/api/system-admin/auth/logout", { method: "POST", redirectOn401: false });
    } catch (error) {
      console.error("Logout error:", error);
    }
    clearSystemAdminToken();
    router.push(SYSTEM_ADMIN_LOGIN);
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Left: brand (+ page menu on small screens) */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Link href="/system-admin/dashboard" className="flex items-center gap-3 flex-shrink-0">
            <span className="flex items-center justify-center w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-sm">
              <Shield className="w-5 h-5 text-white" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-neutral-900">System Admin</span>
              <span className="block text-xs text-neutral-500">BizBuddy Analytics</span>
            </span>
          </Link>

          {/* Page links (small screens) */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className={linkClass(false)} aria-label="Pages">
                <Menu className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {[...primaryItems, ...moreItems].map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={href}
                    onSelect={() => router.push(href)}
                    className={isActive(href) ? "text-orange-600" : ""}
                  >
                    <Icon /> {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Page links (md and up) */}
        <div className="hidden md:flex flex-none items-center gap-1">
          {primaryItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(isActive(href))} title={label}>
              <Icon className="w-4 h-4" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className={linkClass(moreActive)}>
              More <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {moreItems.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem
                  key={href}
                  onSelect={() => router.push(href)}
                  className={isActive(href) ? "text-orange-600" : ""}
                >
                  <Icon /> {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <ScreenshotButton compact />

          {/* modal={false}: opening the token dialog from a menu item otherwise leaves the page unclickable */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-neutral-100 transition-colors">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xs font-semibold">
                {initialsOf(admin?.name)}
              </span>
              <span className="hidden sm:block text-sm font-medium text-neutral-800 max-w-[10rem] truncate">
                {admin?.name?.split(" ")[0]}
              </span>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold text-foreground truncate">{admin?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  @{admin?.username} · {admin?.isOwner ? "Owner" : "Admin"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/system-admin/account")}>
                <UserCog /> My account
              </DropdownMenuItem>
              {admin?.isOwner && (
                <DropdownMenuItem onSelect={() => router.push("/system-admin/admins")}>
                  <ShieldCheck /> System admins
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setTokenOpen(true)}>
                <KeyRound /> View token
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="text-red-600 focus:text-red-700">
                <LogOut /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <TokenDialog open={tokenOpen} onOpenChange={setTokenOpen} />
    </nav>
  );
}
