"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function DesktopAuthorizeContent() {
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();

    const [message, setMessage] = useState(
        "Checking your FocusTrace session..."
    );

    useEffect(() => {
        if (status === "loading") {
            setMessage("Checking your FocusTrace session...");
            return;
        }

        if (status === "unauthenticated") {
            setMessage("Please sign in to authorize FocusTrace Desktop.");
            return;
        }

        if (status === "authenticated") {
            setMessage(
                `Signed in as ${session?.user?.email ?? "FocusTrace user"}.`
            );
        }
    }, [status, session]);

    const handleLogin = async () => {
        await signIn("google", {
            callbackUrl: window.location.href,
        });
    };

    const handleAuthorize = async () => {
        try {
            setMessage("Authorizing this computer...");

            const response = await fetch("/api/desktop/authorize", {
                method: "POST",
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ?? "Desktop authorization failed"
                );
            }

            const callbackUrl = searchParams.get("callback");

            if (!callbackUrl) {
                throw new Error(
                    "Desktop callback address is missing."
                );
            }

            const redirectUrl = new URL(callbackUrl);

            redirectUrl.searchParams.set("code", data.code);

            window.location.href = redirectUrl.toString();
        } catch (error) {
            console.error(error);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Desktop authorization failed."
            );
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-md rounded-xl border p-8 text-center shadow-sm">
                <h1 className="text-2xl font-semibold">
                    FocusTrace Desktop
                </h1>

                <p className="mt-4 text-gray-600">
                    {message}
                </p>

                {status === "unauthenticated" && (
                    <button
                        onClick={handleLogin}
                        className="mt-6 rounded-lg bg-black px-5 py-3 text-white"
                    >
                        Sign in with Google
                    </button>
                )}

                {status === "authenticated" && (
                    <button
                        onClick={handleAuthorize}
                        className="mt-6 rounded-lg bg-black px-5 py-3 text-white"
                    >
                        Authorize this computer
                    </button>
                )}
            </div>
        </main>
    );
}

export default function DesktopAuthorizePage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen flex items-center justify-center">
                    <p>Loading FocusTrace authorization...</p>
                </main>
            }
        >
            <DesktopAuthorizeContent />
        </Suspense>
    );
}