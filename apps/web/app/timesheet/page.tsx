"use client";

import { useEffect, useState } from "react";

type TimesheetEntry = {
  id: string;
  startTime: string;
  endTime: string;
  description: string;
  category: string;
  confidence: number | null;
};

type TimesheetResponse = {
  success: boolean;
  timesheet: {
    id: string;
    date: string;
  } | null;
  entries: TimesheetEntry[];
};

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString([], {
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

  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}

function getTodayDate() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTotalDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  if (minutes < 1) {
    return `${Math.floor(seconds)}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

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

export default function TimesheetPage() {
  const [date, setDate] = useState(getTodayDate());
  const [data, setData] =
    useState<TimesheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
        "Could not load timesheet.",
      );
    } finally {
      setLoading(false);
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
        <p className="text-red-400">
          {error}
        </p>
      </div>
    );
  }

  const entries = data?.entries ?? [];

  const totalSeconds = entries.reduce(
    (total, entry) => {
      return (
        total +
        (new Date(entry.endTime).getTime() -
          new Date(
            entry.startTime,
          ).getTime()) /
        1000
      );
    },
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Timesheet
          </h2>

          <p className="mt-2 text-zinc-400">
            Automatically generated from
            your activity.
          </p>
        </div>

        <input
          type="date"
          value={date}
          onChange={(event) =>
            setDate(event.target.value)
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white outline-none focus:border-zinc-500"
        />
      </section>

      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Active Periods
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
            Automatically Generated
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
              No tracked activity for
              this date.
            </p>
          </div>
        ) : (
          entries.map(
            (entry, index) => (
              <div
                key={entry.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-300">
                        {index +
                          1}
                      </span>

                      <h4 className="text-lg font-semibold">
                        {formatTime(
                          entry.startTime,
                        )}{" "}
                        —{" "}
                        {formatTime(
                          entry.endTime,
                        )}
                      </h4>
                    </div>

                    <p className="mt-2 ml-11 text-sm text-zinc-500">
                      {formatDuration(
                        entry.startTime,
                        entry.endTime,
                      )}
                    </p>
                  </div>

                  <span className="w-fit rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                    Automatically
                    generated
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
                    {formatCategory(
                      entry.category,
                    )}
                  </span>

                  {entry.confidence !==
                    null && (
                      <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400">
                        Confidence:{" "}
                        {Math.round(
                          entry.confidence *
                          100,
                        )}
                        %
                      </span>
                    )}
                </div>

                <p className="mt-5 text-sm leading-6 text-zinc-300">
                  {entry.description}
                </p>
              </div>
            ),
          )
        )}
      </section>
    </div>
  );
}