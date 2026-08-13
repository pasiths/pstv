import Link from "next/link";
import Image from "next/image";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/actions/auth";
import { Heart, LayoutDashboard, UserRound } from "lucide-react";

type SiteHeaderProps = {
  user?: {
    name: string;
    email: string;
  } | null;
  isAdmin?: boolean;
};

export function SiteHeader({ user, isAdmin }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <Image
            src="/icons/logo-nav.png"
            alt="PSTV"
            width={32}
            height={32}
            className="size-8 rounded-lg"
            priority
          />
          <span className="font-heading text-lg tracking-tight">
            PS<span className="text-teal-500">TV</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/favorites">
                <Heart className="size-4" />
                <span className="hidden sm:inline">My List</span>
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          )}
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings">
                  <UserRound className="size-4" />
                  <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
                </Link>
              </Button>
              <form action={logoutUser}>
                <Button type="submit" variant="outline" size="sm">
                  Logout
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          )}
          <ModeToggle />
        </nav>
      </div>
    </header>
  );
}
