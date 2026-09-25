"use client";

import { useEffect, useState } from "react";

type TimesheetEntry = {
  id: string;
  startTime: string;
  endTime: string;
  description: string;
  category: string;
  confidence: number | null;
  approved: boolean;
  project: {
    id: string;
    name: string;
  } | null;
};

type TimesheetResponse = {
  success: boolean;
  timesheet: {
    id: string;
    date: string;
  } | null;
  entries: TimesheetEntry[];
};

const categories = [
  "DESIGN",
  "RESEARCH",
  "COMMUNICATION",
  "DOCUMENTATION",
  "DEVELOPMENT",
  "OTHER",
];

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDuration(start: string, end: string) {
  const seconds =
    (new Date(end).getTime() -
      new Date(start).getTime()) /
    1000;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 1) {
    return `${Math.floor(seconds)}s`;
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatCategory(category: string) {
  return (
    category.charAt(0) +
    category.slice(1).toLowerCase()
  );
}

function getTodayDate() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function TimesheetPage() {
  const [date, setDate] = useState(getTodayDate());

  const [data, setData] =
    useState<TimesheetResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");

  async function loadTimesheet(selectedDate: string) {
    try {
      setLoading(true);
      setError("");

      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch(
        `/api/timesheets?date=${selectedDate}&timezone=${encodeURIComponent(
          timezone,
        )}`,
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load timesheet",
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error ||
            "Failed to load timesheet",
        );
      }

      setData(result);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Could not load timesheet.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateTimesheet() {
    try {
      setGenerating(true);
      setError("");

      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch(
        "/api/timesheets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date,
            timezone,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Could not generate timesheet",
        );
      }

      setData(result);

      // Refresh once more so the page displays
      // exactly what is stored in the database.
      await loadTimesheet(date);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Could not generate timesheet.",
      );
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    loadTimesheet(date);
  }, [date]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-zinc-500">
          Loading timesheet...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-5">
          <p className="text-red-400">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              loadTimesheet(date)
            }
            className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const entries = data?.entries ?? [];

  const totalSeconds = entries.reduce(
    (total, entry) => {
      return (
        total +
        (new Date(entry.endTime).getTime() -
          new Date(entry.startTime).getTime()) /
          1000
      );
    },
    0,
  );

  function formatTotalDuration(
    seconds: number,
  ) {
    const minutes = Math.floor(
      seconds / 60,
    );

    if (minutes < 1) {
      return `${Math.floor(seconds)}s`;
    }

    const hours = Math.floor(
      minutes / 60,
    );

    const remainingMinutes =
      minutes % 60;

    if (hours === 0) {
      return `${minutes}m`;
    }

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Timesheet
          </h2>

          <p className="mt-2 text-zinc-400">
            Automatically generated from your
            recorded activity.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <input
            type="date"
            value={date}
            onChange={(event) =>
              setDate(event.target.value)
            }
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white outline-none focus:border-zinc-500"
          />

          <button
            type="button"
            onClick={generateTimesheet}
            disabled={generating}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating
              ? "Generating..."
              : "Generate Timesheet"}
          </button>
        </div>
      </section>

      {/* Information */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-zinc-400">
            ●
          </div>

          <div>
            <p className="font-medium text-zinc-200">
              Automatically generated
            </p>

            <p className="mt-1 text-sm leading-6 text-zinc-500">
              This timesheet is generated directly
              from recorded activity. Entries are
              read-only and do not require employee
              or HR approval.
            </p>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Total Entries
          </p>

          <p className="mt-2 text-2xl font-bold">
            {entries.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Tracked Time
          </p>

          <p className="mt-2 text-2xl font-bold">
            {formatTotalDuration(
              totalSeconds,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Status
          </p>

          <p className="mt-2 text-2xl font-bold">
            {entries.length > 0
              ? "Generated"
              : "No activity"}
          </p>
        </div>
      </section>

      {/* Date */}
      <section>
        <h3 className="text-xl font-semibold">
          {formatDate(date)}
        </h3>
      </section>

      {/* Entries */}
      <section className="space-y-4">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-zinc-400">
              No timesheet entries for this
              date.
            </p>

            <p className="mt-2 text-sm text-zinc-600">
              Generate the timesheet after
              activity has been recorded.
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
            >
              {/* Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-lg font-semibold">
                      {formatTime(
                        entry.startTime,
                      )}{" "}
                      —{" "}
                      {formatTime(
                        entry.endTime,
                      )}
                    </h4>

                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                      Automatically generated
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-zinc-500">
                    {formatDuration(
                      entry.startTime,
                      entry.endTime,
                    )}
                  </p>
                </div>

                {entry.confidence !==
                  null && (
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">
                      Confidence
                    </p>

                    <p className="mt-1 font-semibold">
                      {Math.round(
                        entry.confidence *
                          100,
                      )}
                      %
                    </p>
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="mt-5">
                <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
                  {formatCategory(
                    entry.category,
                  )}
                </span>
              </div>

              {/* Description */}
              <div className="mt-5">
                <p className="text-sm leading-6 text-zinc-300">
                  {entry.description}
                </p>
              </div>

              {/* Project */}
              <div className="mt-4">
                <p className="text-xs text-zinc-500">
                  Project
                </p>

                <p className="mt-1 text-sm text-zinc-300">
                  {entry.project?.name ??
                    "No project assigned"}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

