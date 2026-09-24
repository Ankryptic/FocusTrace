import Link from "next/link";
import { SignOutButton } from "../components/AuthButtons";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-zinc-800 bg-zinc-900 md:block">
          <div className="flex h-16 items-center border-b border-zinc-800 px-6">
            <Link href="/dashboard" className="text-xl font-bold">
              FocusTrace
            </Link>
          </div>

          <nav className="space-y-1 p-4">
            <NavItem href="/dashboard" label="Dashboard" icon="📊" />
            <NavItem href="/timesheet" label="Timesheet" icon="🕒" />
            <NavItem href="/projects" label="Projects" icon="📁" />
            <NavItem href="/analytics" label="Analytics" icon="📈" />
          </nav>
        </aside>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
            <div>
              <h1 className="font-semibold">Dashboard</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                🔔
              </button>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-sm font-medium">
                A
              </div>

              <SignOutButton />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}