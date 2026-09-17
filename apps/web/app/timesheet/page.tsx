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
    (new Date(end).getTime() - new Date(start).getTime()) / 1000;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 1) {
    return `${Math.floor(seconds)}s`;
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

function formatCategory(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
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

  const [data, setData] = useState<TimesheetResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);

  async function loadTimesheet(selectedDate: string) {
    try {
      setLoading(true);
      setError("");

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch(
        `/api/timesheets?date=${selectedDate}&timezone=${encodeURIComponent(timezone)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load timesheet");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load timesheet");
      }

      setData(result);
    } catch (error) {
      console.error(error);
      setError("Could not load timesheet.");
    } finally {
      setLoading(false);
    }
  }

  async function generateTimesheet() {
    try {
      setGenerating(true);
      setError("");

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch("/api/timesheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          timezone,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Could not generate timesheet",
        );
      }

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

  async function approveEntry(id: string) {
    try {
      setSavingId(id);

      const response = await fetch(`/api/timesheets/entries/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve entry");
      }

      await loadTimesheet(date);
    } catch (error) {
      console.error(error);
      alert("Could not approve this entry.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteEntry(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this timesheet entry?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingId(id);

      const response = await fetch(`/api/timesheets/entries/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete entry");
      }

      await loadTimesheet(date);
    } catch (error) {
      console.error(error);
      alert("Could not delete this entry.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-zinc-500">Loading timesheet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const entries = data?.entries ?? [];

  const pendingCount = entries.filter(
    (entry) => !entry.approved,
  ).length;

  const approvedCount = entries.filter(
    (entry) => entry.approved,
  ).length;


  const totalSeconds = entries.reduce((total, entry) => {
    return (
      total +
      (new Date(entry.endTime).getTime() -
        new Date(entry.startTime).getTime()) /
      1000
    );
  }, 0);

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
            Review your automatically generated timesheet entries.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
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

      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Total Entries</p>

          <p className="mt-2 text-2xl font-bold">
            {entries.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Pending Review</p>

          <p className="mt-2 text-2xl font-bold">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Approved</p>

          <p className="mt-2 text-2xl font-bold">
            {approvedCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Tracked Time</p>

          <p className="mt-2 text-2xl font-bold">
            {formatTotalDuration(totalSeconds)}
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
              No timesheet entries for this date.
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <TimesheetEntryCard
              key={entry.id}
              entry={entry}
              editing={editingId === entry.id}
              saving={savingId === entry.id}
              onEdit={() => setEditingId(entry.id)}
              onCancelEdit={() => setEditingId(null)}
              onApprove={() => approveEntry(entry.id)}
              onDelete={() => deleteEntry(entry.id)}
              onSaved={() => {
                setEditingId(null);
                loadTimesheet(date);
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}

function formatDateTimeLocal(dateString: string) {
  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function TimesheetEntryCard({
  entry,
  editing,
  saving,
  onEdit,
  onCancelEdit,
  onApprove,
  onDelete,
  onSaved,
}: {
  entry: TimesheetEntry;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(entry.description);
  const [category, setCategory] = useState(entry.category);

  const [startTime, setStartTime] = useState(
    formatDateTimeLocal(entry.startTime),
  );

  const [endTime, setEndTime] = useState(
    formatDateTimeLocal(entry.endTime),
  );

  async function saveChanges() {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        alert("End time must be after start time.");
        return;
      }

      const response = await fetch(
        `/api/timesheets/entries/${entry.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description,
            category,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
          }),
        },
      );

      if (!response.ok) {
        const result = await response.json();

        throw new Error(
          result.error || "Failed to update entry",
        );
      }

      onSaved();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Could not update entry.",
      );
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      {!editing ? (
        <>
          {/* Entry header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-semibold">
                  {formatTime(entry.startTime)} —{" "}
                  {formatTime(entry.endTime)}
                </h4>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.approved
                    ? "bg-zinc-700 text-zinc-200"
                    : "bg-white text-black"
                    }`}
                >
                  {entry.approved ? "Approved" : "Needs review"}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                {formatDuration(entry.startTime, entry.endTime)}
              </p>
            </div>

            {entry.confidence !== null && (
              <div className="text-right">
                <p className="text-xs text-zinc-500">
                  Confidence
                </p>

                <p className="mt-1 font-semibold">
                  {Math.round(entry.confidence * 100)}%
                </p>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="mt-5">
            <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
              {formatCategory(entry.category)}
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
            <p className="text-xs text-zinc-500">Project</p>

            <p className="mt-1 text-sm text-zinc-300">
              {entry.project?.name ?? "No project assigned"}
            </p>
          </div>

          {/* Actions */}
          {!entry.approved && (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-800 pt-5">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Delete
              </button>

              <button
                type="button"
                onClick={onApprove}
                disabled={saving}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {saving ? "Saving..." : "✓ Approve"}
              </button>
            </div>
          )}
        </>
      ) : (
        /* Edit mode */
        <div className="space-y-5">
          <div>
            <h4 className="text-lg font-semibold">
              Edit Timesheet Entry
            </h4>

            <p className="mt-1 text-sm text-zinc-500">
              Correct the automatically generated information.
            </p>
          </div>

          {/* Start / End */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-zinc-400">
                Start time
              </span>

              <input
                type="datetime-local"
                step="1"
                value={startTime}
                onChange={(event) =>
                  setStartTime(event.target.value)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">
                End time
              </span>

              <input
                type="datetime-local"
                step="1"
                value={endTime}
                onChange={(event) =>
                  setEndTime(event.target.value)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
              />
            </label>
          </div>

          {/* Category */}
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">
              Category
            </span>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {formatCategory(item)}
                </option>
              ))}
            </select>
          </label>

          {/* Description */}
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">
              Description
            </span>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
            />
          </label>

          {/* Edit actions */}
          <div className="flex gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveChanges}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}