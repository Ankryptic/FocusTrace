"use client";

import { useEffect, useState } from "react";

type AnalyticsData = {
  summary: {
    totalTrackedSeconds: number;
    activityCount: number;
    classifiedActivityCount: number;
    averageConfidence: number;
  };

  categoryTotals: Record<string, number>;

  projectTotals: {
    projectId: string | null;
    projectName: string;
    seconds: number;
  }[];

  applicationTotals: Record<string, number>;

  dailyTotals: Record<string, number>;
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor(
    (seconds % 3600) / 60,
  );

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatCategory(
  category: string,
) {
  return category
    .toLowerCase()
    .replace("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getPercentage(
  value: number,
  total: number,
) {
  if (total === 0) {
    return 0;
  }

  return Math.round(
    (value / total) * 100,
  );
}

export default function AnalyticsPage() {
  const [data, setData] =
    useState<AnalyticsData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const response =
          await fetch(
            "/api/analytics",
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Failed to load analytics",
          );
        }

        setData(result);
      } catch (error) {
        console.error(error);

        setError(
          "Could not load analytics data.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">
          Loading analytics...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-red-500">
          {error ||
            "No analytics data available."}
        </p>
      </div>
    );
  }

  const total =
    data.summary.totalTrackedSeconds;

  const categories =
    Object.entries(
      data.categoryTotals,
    ).sort(
      ([, a], [, b]) => b - a,
    );

  const applications =
    Object.entries(
      data.applicationTotals,
    ).sort(
      ([, a], [, b]) => b - a,
    );

  const days =
    Object.entries(
      data.dailyTotals,
    ).sort(
      ([a], [b]) =>
        a.localeCompare(b),
    );

  return (
    <div className="p-8">

      {/* Header */}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Analytics
        </h1>

        <p className="mt-2 text-slate-500">
          Understand how your time is being
          spent across projects and activities.
        </p>
      </div>

      {/* Summary */}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">

        <StatCard
          title="Tracked Time"
          value={formatDuration(total)}
        />

        <StatCard
          title="Activities"
          value={String(
            data.summary.activityCount,
          )}
        />

        <StatCard
          title="Classified"
          value={String(
            data.summary
              .classifiedActivityCount,
          )}
        />

        <StatCard
          title="Avg. Confidence"
          value={`${Math.round(
            data.summary
              .averageConfidence * 100,
          )}%`}
        />

      </div>

      {/* Main grid */}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Categories */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Time by Category
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              How your tracked time was classified.
            </p>
          </div>

          <div className="space-y-5">

            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">
                No category data yet.
              </p>
            ) : (
              categories.map(
                ([category, seconds]) => {
                  const percentage =
                    getPercentage(
                      seconds,
                      total,
                    );

                  return (
                    <div
                      key={category}
                    >
                      <div className="mb-2 flex items-center justify-between">

                        <span className="text-sm font-medium text-slate-700">
                          {formatCategory(
                            category,
                          )}
                        </span>

                        <span className="text-sm text-slate-500">
                          {formatDuration(
                            seconds,
                          )}{" "}
                          · {percentage}%
                        </span>

                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-slate-900 transition-all"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />

                      </div>
                    </div>
                  );
                },
              )
            )}

          </div>
        </section>

        {/* Projects */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Time by Project
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Where your tracked time is going.
            </p>
          </div>

          <div className="space-y-4">

            {data.projectTotals.length ===
            0 ? (
              <p className="text-sm text-slate-500">
                No project data yet.
              </p>
            ) : (
              data.projectTotals
                .sort(
                  (a, b) =>
                    b.seconds -
                    a.seconds,
                )
                .map((project) => {
                  const percentage =
                    getPercentage(
                      project.seconds,
                      total,
                    );

                  return (
                    <div
                      key={
                        project.projectId ??
                        "unassigned"
                      }
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {project.projectName}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {percentage}% of tracked time
                        </p>
                      </div>

                      <span className="font-semibold text-slate-900">
                        {formatDuration(
                          project.seconds,
                        )}
                      </span>
                    </div>
                  );
                })
            )}

          </div>
        </section>

      </div>

      {/* Applications */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Application Usage
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Applications contributing to your
            tracked activity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

          {applications.map(
            ([application, seconds]) => (
              <div
                key={application}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">

                  <span className="font-medium text-slate-800">
                    {application}
                  </span>

                  <span className="text-sm text-slate-500">
                    {formatDuration(
                      seconds,
                    )}
                  </span>

                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">

                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{
                      width: `${getPercentage(
                        seconds,
                        total,
                      )}%`,
                    }}
                  />

                </div>
              </div>
            ),
          )}

        </div>
      </section>

      {/* Daily activity */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Daily Activity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Your tracked time by day.
          </p>
        </div>

        <div className="space-y-4">

          {days.length === 0 ? (
            <p className="text-sm text-slate-500">
              No daily activity yet.
            </p>
          ) : (
            days.map(
              ([date, seconds]) => (
                <div
                  key={date}
                  className="flex items-center gap-4"
                >

                  <div className="w-28 shrink-0 text-sm font-medium text-slate-700">
                    {new Date(
                      `${date}T00:00:00`,
                    ).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </div>

                  <div className="h-8 flex-1 overflow-hidden rounded-lg bg-slate-100">

                    <div
                      className="flex h-full items-center rounded-lg bg-slate-800 px-3 text-xs font-medium text-white"
                      style={{
                        width: `${Math.max(
                          getPercentage(
                            seconds,
                            total,
                          ),
                          5,
                        )}%`,
                      }}
                    >
                      {formatDuration(
                        seconds,
                      )}
                    </div>

                  </div>

                </div>
              ),
            )
          )}

        </div>
      </section>

    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">

      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-2xl font-bold text-slate-900">
        {value}
      </p>

    </div>
  );
}