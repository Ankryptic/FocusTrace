"use client";

import { useEffect, useState } from "react";

type PrivacySettings = {
  trackingEnabled: boolean;
  retentionDays: number;
};

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<PrivacySettings | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [deletingData, setDeletingData] =
    useState(false);

  const [deleteMessage, setDeleteMessage] =
    useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const response =
          await fetch(
            "/api/settings/privacy",
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Failed to load settings",
          );
        }

        setSettings(
          data.settings,
        );
      } catch (error) {
        console.error(error);

        setError(
          "Could not load privacy settings.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function updateSettings(
    updates: Partial<PrivacySettings>,
  ) {
    if (!settings) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/settings/privacy",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              updates,
            ),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to update settings",
        );
      }

      setSettings(
        data.settings,
      );

      setMessage(
        "Settings saved successfully.",
      );

      setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error) {
      console.error(error);

      setError(
        "Could not save your settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteActivityData() {
  const confirmed = window.confirm(
    "Are you sure you want to permanently delete all your tracked activity data? This action cannot be undone.",
  );

  if (!confirmed) {
    return;
  }

  setDeletingData(true);
  setDeleteMessage("");

  try {
    const response = await fetch(
      "/api/settings/privacy/data",
      {
        method: "DELETE",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Failed to delete activity data",
      );
    }

    setDeleteMessage(
      `Deleted ${data.deletedCount} activity records successfully.`,
    );
  } catch (error) {
    console.error(
      "Delete activity data error:",
      error,
    );

    setDeleteMessage(
      "Could not delete activity data.",
    );
  } finally {
    setDeletingData(false);
  }
}

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">
          Loading settings...
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <p className="text-red-500">
          {error ||
            "Settings unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">

      {/* Header */}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Settings
        </h1>

        <p className="mt-2 text-slate-500">
          Control how FocusTrace collects and
          stores your activity data.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-w-3xl space-y-6">

        {/* Tracking */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">

          <div className="flex items-start justify-between gap-6">

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Activity Tracking
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                When enabled, FocusTrace records
                the active desktop application,
                window title, and time spent.
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                updateSettings({
                  trackingEnabled:
                    !settings.trackingEnabled,
                })
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${settings.trackingEnabled
                ? "bg-slate-900"
                : "bg-slate-300"
                }`}
              aria-label="Toggle activity tracking"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${settings.trackingEnabled
                  ? "left-6"
                  : "left-1"
                  }`}
              />
            </button>

          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            <div className="flex items-center gap-3">

              <div
                className={`h-2.5 w-2.5 rounded-full ${settings.trackingEnabled
                  ? "bg-green-500"
                  : "bg-slate-400"
                  }`}
              />

              <span className="text-sm font-medium text-slate-700">
                {settings.trackingEnabled
                  ? "Tracking is enabled"
                  : "Tracking is disabled"}
              </span>

            </div>

          </div>

        </section>

        {/* Data retention */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">

          <h2 className="text-lg font-semibold text-slate-900">
            Data Retention
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Choose how long FocusTrace should
            retain your activity records.
          </p>

          <div className="mt-5">

            <label
              htmlFor="retention"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Retention period
            </label>

            <select
              id="retention"
              value={
                settings.retentionDays
              }
              disabled={saving}
              onChange={(event) =>
                updateSettings({
                  retentionDays:
                    Number(
                      event.target.value,
                    ),
                })
              }
              className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
            >
              <option value={7}>
                7 days
              </option>

              <option value={14}>
                14 days
              </option>

              <option value={30}>
                30 days
              </option>

              <option value={60}>
                60 days
              </option>

              <option value={90}>
                90 days
              </option>

              <option value={180}>
                180 days
              </option>

              <option value={365}>
                1 year
              </option>
            </select>

          </div>

        </section>

        {/* Privacy information */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">

          <h2 className="text-lg font-semibold text-slate-900">
            What FocusTrace Collects
          </h2>

          <div className="mt-5 space-y-4">

            <PrivacyItem
              title="Application name"
              description="The desktop application currently in use."
            />

            <PrivacyItem
              title="Window title"
              description="The title of the active application window."
            />

            <PrivacyItem
              title="Time information"
              description="When an activity started, ended, and how long it lasted."
            />

            <PrivacyItem
              title="Activity classification"
              description="An automatically generated category and confidence score."
            />

            <PrivacyItem
              title="Project association"
              description="The project selected for the activity, when applicable."
            />

          </div>

        </section>

        {/* Privacy principle */}

        <section className="rounded-2xl bg-slate-900 p-6 text-white">

          <h2 className="text-lg font-semibold">
            Your activity belongs to you.
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            FocusTrace is designed to make activity
            tracking transparent. You control whether
            tracking is enabled, how long activity data
            is retained, and whether automatically
            generated timesheet entries are approved.
          </p>

        </section>

        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-red-400">
              Delete activity data
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Permanently delete all tracked application
              activity and its AI classifications.
              Your existing timesheet entries will not
              be deleted.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDeleteActivityData}
            disabled={deletingData}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deletingData
              ? "Deleting..."
              : "Delete my activity data"}
          </button>

          {deleteMessage && (
            <p className="mt-3 text-sm text-gray-400">
              {deleteMessage}
            </p>
          )}
        </section>

      </div>

    </div>
  );
}

function PrivacyItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">

      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
        ✓
      </div>

      <div>
        <p className="text-sm font-medium text-slate-800">
          {title}
        </p>

        <p className="mt-1 text-sm leading-5 text-slate-500">
          {description}
        </p>
      </div>

    </div>
  );
}