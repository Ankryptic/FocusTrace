"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  success: boolean;
  date: string;
  stats: {
    totalTrackedSeconds: number;
    activityCount: number;
    pendingEntries: number;
    projectCount: number;
  };
  categoryTotals: Record<string, number>;
  recentActivities: {
    id: string;
    application: string;
    windowTitle: string | null;
    startedAt: string;
    endedAt: string;
    duration: number;
    project: {
      id: string;
      name: string;
    } | null;
    classification: {
      category: string;
      confidence: number;
      reason: string | null;
    } | null;
  }[];
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${remainingSeconds}s`;
}

function formatCategory(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function getApplicationIcon(application: string) {
  const app = application.toLowerCase();

  if (app.includes("code")) return "💻";
  if (app.includes("chrome")) return "🌐";
  if (app.includes("figma")) return "🎨";
  if (app.includes("firefox")) return "🦊";
  if (app.includes("terminal")) return "⌨️";

  return "🖥️";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard");

        if (!response.ok) {
          throw new Error("Failed to load dashboard");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to load dashboard");
        }

        setData(result);
      } catch (error) {
        console.error(error);
        setError("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-zinc-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-red-400">{error || "Something went wrong."}</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Tracked Time",
      value: formatDuration(data.stats.totalTrackedSeconds),
      description: "Today",
    },
    {
      label: "Activities",
      value: data.stats.activityCount,
      description: "Today",
    },
    {
      label: "Timesheet Entries",
      value: data.stats.pendingEntries,
      description: "Pending review",
    },
    {
      label: "Projects",
      value: data.stats.projectCount,
      description: "Active",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Heading */}
      <section>
        <h2 className="text-3xl font-bold tracking-tight">
          Good afternoon 👋
        </h2>

        <p className="mt-2 text-zinc-400">
          Here&apos;s an overview of your activity today.
        </p>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <p className="text-sm text-zinc-400">{stat.label}</p>

            <p className="mt-2 text-2xl font-bold">{stat.value}</p>

            <p className="mt-1 text-xs text-zinc-500">
              {stat.description}
            </p>
          </div>
        ))}
      </section>

      {/* Category breakdown */}
      <section>
        <div className="mb-4">
          <h3 className="text-xl font-semibold">Activity Breakdown</h3>

          <p className="mt-1 text-sm text-zinc-500">
            Time spent by activity category
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.categoryTotals).map(
            ([category, seconds]) => (
              <div
                key={category}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {formatCategory(category)}
                  </p>

                  <p className="text-sm text-zinc-400">
                    {formatDuration(seconds)}
                  </p>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{
                      width: `${Math.min(
                        (seconds / data.stats.totalTrackedSeconds) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-4">
          <h3 className="text-xl font-semibold">Recent Activity</h3>

          <p className="mt-1 text-sm text-zinc-500">
            Your latest tracked activities
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {data.recentActivities.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No activity recorded today.
            </div>
          ) : (
            data.recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between border-b border-zinc-800 p-5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                    {getApplicationIcon(activity.application)}
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium">
                      {activity.application}
                    </p>

                    <p className="truncate text-sm text-zinc-500">
                      {activity.classification
                        ? formatCategory(
                            activity.classification.category,
                          )
                        : "Unclassified"}
                    </p>
                  </div>
                </div>

                <p className="ml-4 shrink-0 text-sm font-medium text-zinc-300">
                  {formatDuration(activity.duration)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Timesheet suggestion */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              Timesheet suggestions
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              {data.stats.pendingEntries > 0
                ? `You have ${data.stats.pendingEntries} entries waiting for review.`
                : "Your timesheet is up to date."}
            </p>
          </div>

          <a
            href="/timesheet"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Review timesheet
          </a>
        </div>
      </section>
    </div>
  );
}