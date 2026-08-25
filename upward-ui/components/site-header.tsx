"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { SearchDialog } from "@/components/search-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  BookOpenIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
} from "lucide-react";

const navLinks = [
  { href: "/courses", label: "Courses", icon: BookOpenIcon },
  { href: "/bundles", label: "Bundles", icon: LayersIcon },
];

export function SiteHeader() {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  return (
    <header className="bg-background/80 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <GraduationCapIcon className="size-5" />
          </span>
          <span className="text-lg tracking-tight">Upward</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant={pathname.startsWith(link.href) ? "secondary" : "ghost"}
              size="sm"
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <form
          className="ml-auto hidden w-full max-w-xs lg:block"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <button type="button" onClick={() => setSearchOpen(true)} className="w-full text-left">
            <InputGroup className="hover:bg-muted/50 cursor-text">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput placeholder="Search…" tabIndex={-1} readOnly />
              <kbd className="text-muted-foreground bg-muted mr-2 hidden rounded border px-1.5 font-mono text-[10px] sm:inline-flex">
                ⌘K
              </kbd>
            </InputGroup>
          </button>
        </form>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            className="lg:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon />
          </Button>

          {user ? (
            <>
              <Button variant="default" size="sm" render={<Link href="/dashboard" />} className="hidden sm:inline-flex">
                My Learning
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button aria-label="Account menu" className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      <Avatar className="size-9 border">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="text-muted-foreground truncate text-xs font-normal">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href="/dashboard" />}>
                      <LayoutDashboardIcon /> My Learning
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/settings" />}>
                      <SettingsIcon /> Settings
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem render={<Link href="/admin" />}>
                        <ShieldIcon /> Admin panel
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
                    <LogOutIcon /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>
                Log in
              </Button>
              <Button size="sm" render={<Link href="/register" />}>
                Sign up free
              </Button>
            </div>
          )}

          {/* Mobile nav */}
          <DropdownMenu open={mobileOpen} onOpenChange={setMobileOpen}>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu" />}>
              <MenuIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 md:hidden">
              {user ? (
                <DropdownMenuItem render={<Link href="/dashboard" />}>
                  <LayoutDashboardIcon /> My Learning
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem render={<Link href="/login" />}>Log in</DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/register" />}>Sign up free</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {navLinks.map((link) => (
                <React.Fragment key={link.href}>
                  <DropdownMenuItem render={<Link href={link.href} />}>{link.label}</DropdownMenuItem>
                </React.Fragment>
              ))}
              {isAdmin && (
                <>
                  <Separator className="my-1" />
                  <DropdownMenuItem render={<Link href="/admin" />}>Admin panel</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
