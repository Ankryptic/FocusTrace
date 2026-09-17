import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { SignInButton } from "./components/AuthButtons";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
      <div className="w-full max-w-lg text-center">
        <div className="mb-4 text-5xl">🎯</div>

        <h1 className="text-5xl font-bold tracking-tight">
          FocusTrace
        </h1>

        <p className="mt-4 text-lg leading-7 text-zinc-400">
          Turn your desktop activity into intelligent,
          reviewable timesheets.
        </p>

        <div className="mt-8">
          <SignInButton />
        </div>

        <p className="mt-5 text-xs text-zinc-500">
          Sign in to start tracking your focused work.
        </p>
      </div>
    </main>
  );
}