import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/actions/auth";
import { Heart, LayoutDashboard, Radio, UserRound } from "lucide-react";

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
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-teal-600 text-white">
            <Radio className="size-4" />
          </span>
          <span className="font-heading text-lg">
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
