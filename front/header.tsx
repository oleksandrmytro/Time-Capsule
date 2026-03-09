"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, Timer, User, LogOut, Plus, Archive, Search, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// Simulated auth state for UI demo purposes
const DEMO_AUTHENTICATED = true

export function Header() {
  const [isAuthenticated] = useState(DEMO_AUTHENTICATED)

  const navLinks = isAuthenticated
    ? [
        { href: "/", label: "Home" },
        { href: "/capsules", label: "My Capsules", icon: Archive },
        { href: "/capsules/create", label: "Create", icon: Plus },
        { href: "/search", label: "Search", icon: Search },
        { href: "/chat", label: "Messages", icon: MessageCircle },
        { href: "/account", label: "Profile", icon: User },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/login", label: "Login" },
        { href: "/register", label: "Register" },
      ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Timer className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">
            TimeCapsule
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.icon && <link.icon className="h-4 w-4" />}
              {link.label}
            </Link>
          ))}
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          )}
        </nav>

        {/* Mobile Nav */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-1 pt-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {link.icon && <link.icon className="h-4 w-4" />}
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && (
                <button className="mt-4 flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
