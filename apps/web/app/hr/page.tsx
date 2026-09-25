"use client";

import { useEffect, useState } from "react";
import { SignOutButton } from "@/app/components/AuthButtons";

type Employee = {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    privacySettings: {
        trackingEnabled: boolean;
        retentionDays: number;
        inactivityTimeoutMinutes: number;
        screenshotIntervalMinutes: number;
    } | null;
};

type ActivityEvent = {
    id: string;
    type: "MOUSE" | "KEYBOARD" | "ACTIVE_WINDOW";
    timestamp: string;
    mouseDistance: number | null;
    mouseClicks: number | null;
    keyPresses: number | null;
    metadata: {
        application?: string;
        website?: string;
        [key: string]: unknown;
    } | null;
};

type Screenshot = {
    id: string;
    storageKey: string;
    application: string | null;
    website: string | null;
    capturedAt: string;
};

type TimesheetEntry = {
    id: string;
    startTime: string;
    endTime: string;
    description: string;
    category: string;
    confidence: number | null;
};

type EmployeeTimesheet = {
    id: string;
    date: string;
    createdAt: string;
};

type TimesheetData = {
    timesheet: EmployeeTimesheet | null;
    entries: TimesheetEntry[];
};

export default function HRDashboard() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] =
        useState<Employee | null>(null);

    const [trackingEnabled, setTrackingEnabled] =
        useState(true);

    const [inactivityTimeout, setInactivityTimeout] =
        useState(30);

    const [activityEvents, setActivityEvents] =
        useState<ActivityEvent[]>([]);

    const [screenshotInterval, setScreenshotInterval] = useState(5);

    const [screenshots, setScreenshots] =
        useState<Screenshot[]>([]);

    const [screenshotUrls, setScreenshotUrls] =
        useState<Record<string, string>>({});

    const [loadingScreenshot, setLoadingScreenshot] =
        useState<string | null>(null);

    const [selectedScreenshot, setSelectedScreenshot] =
        useState<Screenshot | null>(null);

    const [selectedDate, setSelectedDate] =
        useState(() => {
            const now = new Date();

            return now.toISOString().split("T")[0];
        });

    const [loading, setLoading] = useState(true);
    const [activityLoading, setActivityLoading] =
        useState(false);

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const [timesheetData, setTimesheetData] =
        useState<TimesheetData>({
            timesheet: null,
            entries: [],
        });

    const [timesheetLoading, setTimesheetLoading] =
        useState(false);

    useEffect(() => {
        loadEmployees();
    }, []);

    async function loadEmployees() {
        try {
            const response = await fetch(
                "/api/hr/employees",
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to load employees",
                );
            }

            const data = await response.json();

            setEmployees(data.employees ?? []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function loadActivity(
        employeeId: string,
        date = selectedDate,
    ) {
        setActivityLoading(true);

        try {
            const response = await fetch(
                `/api/hr/employees/${employeeId}/activity?date=${date}`,
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to load activity",
                );
            }

            const data = await response.json();

            setActivityEvents(
                data.activityEvents ?? [],
            );

            setScreenshots(
                data.screenshots ?? [],
            );
        } catch (error) {
            console.error(error);

            setActivityEvents([]);
            setScreenshots([]);
        } finally {
            setActivityLoading(false);
        }
    }

    async function loadScreenshotUrl(screenshotId: string) {
        if (screenshotUrls[screenshotId]) {
            return screenshotUrls[screenshotId];
        }

        setLoadingScreenshot(screenshotId);

        try {
            const response = await fetch(
                `/api/hr/screenshots/${screenshotId}/url`
            );

            const data = await response.json();

            if (!response.ok || !data.url) {
                throw new Error(
                    data.error || "Failed to load screenshot"
                );
            }

            setScreenshotUrls((current) => ({
                ...current,
                [screenshotId]: data.url,
            }));

            return data.url;
        } catch (error) {
            console.error(error);
            return null;
        } finally {
            setLoadingScreenshot(null);
        }
    }

    function selectEmployee(employee: Employee) {
        setSelectedEmployee(employee);

        setTrackingEnabled(
            employee.privacySettings
                ?.trackingEnabled ?? true,
        );

        setInactivityTimeout(
            employee.privacySettings
                ?.inactivityTimeoutMinutes ?? 30,
        );

        setScreenshotInterval(
            employee.privacySettings
                ?.screenshotIntervalMinutes ?? 5,
        );

        setMessage("");

        loadActivity(
            employee.id,
            selectedDate,
        );

        loadTimesheet(
            employee.id,
            selectedDate,
        );
    }

    function handleDateChange(date: string) {
        setSelectedDate(date);

        if (selectedEmployee) {
            loadActivity(
                selectedEmployee.id,
                date,
            );

            loadTimesheet(
                selectedEmployee.id,
                date,
            );
        }
    }

    async function saveSettings() {
        if (!selectedEmployee) return;

        setSaving(true);
        setMessage("");

        try {
            const response = await fetch(
                `/api/hr/employees/${selectedEmployee.id}/privacy`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        trackingEnabled,
                        inactivityTimeoutMinutes:
                            inactivityTimeout,
                        screenshotIntervalMinutes:
                            screenshotInterval,
                    }),
                },
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Failed to save settings",
                );
            }

            setMessage(
                "Settings saved successfully.",
            );

            await loadEmployees();
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to save settings.",
            );
        } finally {
            setSaving(false);
        }
    }

    async function loadTimesheet(
        employeeId: string,
        date = selectedDate,
    ) {
        setTimesheetLoading(true);

        try {
            const timezone =
                Intl.DateTimeFormat().resolvedOptions()
                    .timeZone;

            const response = await fetch(
                `/api/hr/employees/${employeeId}/timesheet?date=${date}&timezone=${encodeURIComponent(
                    timezone,
                )}`,
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to load timesheet",
                );
            }

            const data = await response.json();

            setTimesheetData({
                timesheet:
                    data.timesheet ?? null,
                entries:
                    data.entries ?? [],
            });
        } catch (error) {
            console.error(error);

            setTimesheetData({
                timesheet: null,
                entries: [],
            });
        } finally {
            setTimesheetLoading(false);
        }
    }

    function formatTime(
        timestamp: string,
    ) {
        return new Date(
            timestamp,
        ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function getEventTitle(
        event: ActivityEvent,
    ) {
        if (event.type === "ACTIVE_WINDOW") {
            const application =
                event.metadata?.application;

            const website =
                event.metadata?.website;

            if (website) {
                return `${application || "Browser"} • ${website}`;
            }

            return application ||
                "Active application";
        }

        if (event.type === "MOUSE") {
            return "Mouse activity";
        }

        if (event.type === "KEYBOARD") {
            return "Keyboard activity";
        }

        return "Activity";
    }

    function getEventDescription(
        event: ActivityEvent,
    ) {
        if (event.type === "MOUSE") {
            const distance =
                event.mouseDistance ?? 0;

            const clicks =
                event.mouseClicks ?? 0;

            return `${distance.toLocaleString()} px moved • ${clicks} clicks`;
        }

        if (event.type === "KEYBOARD") {
            const presses =
                event.keyPresses ?? 0;

            return `${presses} key presses`;
        }

        return "Active window changed";
    }

    function getEventIcon(
        type: ActivityEvent["type"],
    ) {
        if (type === "ACTIVE_WINDOW") {
            return "🪟";
        }

        if (type === "MOUSE") {
            return "🖱️";
        }

        return "⌨️";
    }

    if (loading) {
        return (
            <main className="p-8">
                Loading HR dashboard...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 p-8">
            <div className="mx-auto max-w-7xl ">
                <header className="w-full flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">
                            FocusTrace HR Dashboard
                        </h1>

                        <p className="mt-2 text-gray-600">
                            Monitor employee activity and
                            manage tracking settings.
                        </p>
                    </div>
                    <SignOutButton />
                </header>

                <div className="mt-8 grid gap-6 lg:grid-cols-3 ">
                    {/* Employees */}
                    <section className="rounded-xl bg-zinc-900 p-6 shadow border border-gray-400">
                        <h2 className="text-xl font-semibold">
                            Employees
                        </h2>

                        <div className="mt-4 space-y-3">
                            {employees.length === 0 ? (
                                <p className="text-gray-500">
                                    No employees found.
                                </p>
                            ) : (
                                employees.map(
                                    (employee) => (
                                        <button
                                            key={
                                                employee.id
                                            }
                                            onClick={() =>
                                                selectEmployee(
                                                    employee,
                                                )
                                            }
                                            className={`w-full rounded-lg border p-4 text-left transition ${selectedEmployee?.id ===
                                                employee.id
                                                ? "border-black bg-zinc-700"
                                                : "hover:bg-zinc-700"
                                                }`}
                                        >
                                            <div className="font-medium">
                                                {employee.name ||
                                                    "Unnamed employee"}
                                            </div>

                                            <div className="text-sm text-white">
                                                {
                                                    employee.email
                                                }
                                            </div>

                                            <div className="mt-2 text-sm">
                                                Tracking:{" "}
                                                <span
                                                    className={
                                                        employee
                                                            .privacySettings
                                                            ?.trackingEnabled
                                                            ? "font-semibold text-green-600"
                                                            : "font-semibold text-red-600"
                                                    }
                                                >
                                                    {employee
                                                        .privacySettings
                                                        ?.trackingEnabled
                                                        ? "ON"
                                                        : "OFF"}
                                                </span>
                                            </div>
                                        </button>
                                    ),
                                )
                            )}
                        </div>
                    </section>

                    {/* Employee settings */}
                    <section className="rounded-xl bg-zinc-900 border border-gray-400 p-6 shadow">
                        <h2 className="text-xl font-semibold">
                            Employee Settings
                        </h2>

                        {!selectedEmployee ? (
                            <p className="mt-4 text-gray-500">
                                Select an employee.
                            </p>
                        ) : (
                            <div className="mt-6 space-y-6">
                                <div>
                                    <p className="font-medium">
                                        {
                                            selectedEmployee.name
                                        }
                                    </p>

                                    <p className="text-sm text-white">
                                        {
                                            selectedEmployee.email
                                        }
                                    </p>
                                </div>

                                <label className="flex items-center justify-between">
                                    <span className="font-medium">
                                        Tracking
                                    </span>

                                    <input
                                        type="checkbox"
                                        checked={
                                            trackingEnabled
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setTrackingEnabled(
                                                event
                                                    .target
                                                    .checked,
                                            )
                                        }
                                        className="h-5 w-5"
                                    />
                                </label>

                                <label className="block">
                                    <span className="font-medium">
                                        Inactivity timeout
                                    </span>

                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={480}
                                            value={
                                                inactivityTimeout
                                            }
                                            onChange={(
                                                event,
                                            ) =>
                                                setInactivityTimeout(
                                                    Number(
                                                        event
                                                            .target
                                                            .value,
                                                    ),
                                                )
                                            }
                                            className="w-32 rounded-lg border px-3 py-2"
                                        />

                                        <span className="text-gray-500">
                                            minutes
                                        </span>
                                    </div>
                                </label>

                                <label className="block">
                                    <span className="font-medium">
                                        Screenshot interval
                                    </span>

                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={60}
                                            value={screenshotInterval}
                                            onChange={(event) =>
                                                setScreenshotInterval(
                                                    Number(event.target.value),
                                                )
                                            }
                                            className="w-32 rounded-lg border px-3 py-2"
                                        />

                                        <span className="text-gray-500">
                                            minutes
                                        </span>
                                    </div>

                                    <p className="mt-1 text-xs text-gray-500">
                                        How often FocusTrace captures a screenshot
                                        while the employee is active.
                                    </p>
                                </label>

                                <button
                                    onClick={
                                        saveSettings
                                    }
                                    disabled={saving}
                                    className="rounded-lg bg-black px-5 py-2 text-white disabled:opacity-50"
                                >
                                    {saving
                                        ? "Saving..."
                                        : "Save Changes"}
                                </button>

                                {message && (
                                    <p className="text-sm text-gray-600">
                                        {message}
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Activity summary */}
                    <section className="rounded-xl bg-zinc-900 border border-gray-400 p-6 shadow">
                        <h2 className="text-xl font-semibold">
                            Activity
                        </h2>

                        {!selectedEmployee ? (
                            <p className="mt-4 text-gray-500">
                                Select an employee to
                                view activity.
                            </p>
                        ) : (
                            <div className="mt-6">
                                <label className="text-sm font-medium">
                                    Date
                                </label>

                                <input
                                    type="date"
                                    value={
                                        selectedDate
                                    }
                                    onChange={(event) =>
                                        handleDateChange(
                                            event.target
                                                .value,
                                        )
                                    }
                                    className="mt-2 w-full rounded-lg border px-3 py-2 cursor-pointer"
                                />

                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    <div className="rounded-lg bg-zinc-700 p-4">
                                        <p className="text-sm text-gray-400">
                                            Events
                                        </p>

                                        <p className="mt-1 text-2xl font-bold">
                                            {
                                                activityEvents.length
                                            }
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-zinc-700 p-4">
                                        <p className="text-sm text-gray-400">
                                            Screenshots
                                        </p>

                                        <p className="mt-1 text-2xl font-bold">
                                            {
                                                screenshots.length
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Timesheet */}
                    <section className="mt-6 rounded-xl bg-zinc-900 border border-gray-400 p-6 shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">
                                    Timesheet
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    Automatically generated from
                                    tracked activity.
                                </p>
                            </div>

                            {timesheetData.entries.length > 0 && (
                                <div className="rounded-lg bg-zinc-700 px-4 py-2 text-sm">
                                    {timesheetData.entries.length} active
                                    periods
                                </div>
                            )}
                        </div>

                        {timesheetLoading ? (
                            <p className="mt-6 text-gray-500">
                                Loading timesheet...
                            </p>
                        ) : !selectedEmployee ? (
                            <p className="mt-6 text-gray-500">
                                Select an employee to view their
                                timesheet.
                            </p>
                        ) : timesheetData.entries.length === 0 ? (
                            <div className="mt-6 rounded-lg border border-gray-200 p-8 text-center">
                                <p className="text-gray-500">
                                    No automatically generated
                                    timesheet entries for this date.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-3">
                                {timesheetData.entries.map(
                                    (entry, index) => {
                                        const start =
                                            new Date(
                                                entry.startTime,
                                            );

                                        const end =
                                            new Date(
                                                entry.endTime,
                                            );

                                        const duration =
                                            Math.round(
                                                (end.getTime() -
                                                    start.getTime()) /
                                                60000,
                                            );

                                        return (
                                            <div
                                                key={entry.id}
                                                className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs">
                                                            {index + 1}
                                                        </span>

                                                        <p className="font-medium">
                                                            {start.toLocaleTimeString(
                                                                [],
                                                                {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                },
                                                            )}
                                                            {" — "}
                                                            {end.toLocaleTimeString(
                                                                [],
                                                                {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                },
                                                            )}
                                                        </p>
                                                    </div>

                                                    <p className="mt-1 ml-10 text-sm text-gray-500">
                                                        {duration} minutes
                                                    </p>
                                                </div>

                                                <div className="flex flex-col items-start gap-2 sm:items-end">
                                                    <div className="flex items-center gap-3">
                                                        <span className="rounded-md bg-zinc-700 px-3 py-1 text-xs text-white">
                                                            {entry.category}
                                                        </span>

                                                        <span className="rounded-md bg-zinc-700 px-3 py-1 text-xs text-white">
                                                            Automatic
                                                        </span>
                                                    </div>

                                                    {entry.description && (
                                                        <p className="text-sm text-white">
                                                            {entry.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Activity timeline */}
                {selectedEmployee && (
                    <section className="mt-6 rounded-xl bg-zinc-900 border border-gray-400 p-6 shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">
                                    Activity Timeline
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    {
                                        selectedEmployee.name
                                    }{" "}
                                    •{" "}
                                    {selectedDate}
                                </p>
                            </div>

                            <button
                                onClick={() =>
                                    loadActivity(
                                        selectedEmployee.id,
                                        selectedDate,
                                    )
                                }
                                disabled={
                                    activityLoading
                                }
                                className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                            >
                                {activityLoading
                                    ? "Refreshing..."
                                    : "Refresh"}
                            </button>
                        </div>

                        {activityLoading ? (
                            <div className="py-12 text-center text-gray-500">
                                Loading activity...
                            </div>
                        ) : activityEvents.length ===
                            0 ? (
                            <div className="py-12 text-center text-gray-500">
                                No activity recorded
                                for this date.
                            </div>
                        ) : (
                            <div className="mt-6">
                                {activityEvents.map(
                                    (
                                        event,
                                        index,
                                    ) => (
                                        <div
                                            key={
                                                event.id
                                            }
                                            className="relative flex gap-4 pb-6"
                                        >
                                            {index <
                                                activityEvents.length -
                                                1 && (
                                                    <div className="absolute left-[15px] top-8 h-full w-px bg-gray-200" />
                                                )}

                                            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm">
                                                {getEventIcon(
                                                    event.type,
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1 rounded-lg border p-4">
                                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                    <p className="font-medium">
                                                        {getEventTitle(
                                                            event,
                                                        )}
                                                    </p>

                                                    <time className="text-sm text-white">
                                                        {formatTime(
                                                            event.timestamp,
                                                        )}
                                                    </time>
                                                </div>

                                                <p className="mt-1 text-sm text-white">
                                                    {getEventDescription(
                                                        event,
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        )}
                    </section>
                )}

                {/* Screenshots */}
                {selectedEmployee && (
                    <section className="mt-6 rounded-xl bg-zinc-900 border border-gray-400 p-6 shadow">
                        <h2 className="text-xl font-semibold">
                            Screenshot Activity
                        </h2>

                        {screenshots.length ===
                            0 ? (
                            <p className="mt-6 text-gray-500">
                                No screenshots recorded
                                for this date.
                            </p>
                        ) : (
                            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {screenshots.map((screenshot) => {
                                    const imageUrl = screenshotUrls[screenshot.id];

                                    return (
                                        <div
                                            key={screenshot.id}
                                            className="overflow-hidden rounded-lg border bg-zinc-700"
                                        >
                                            {imageUrl ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedScreenshot(screenshot)}
                                                    className="block w-full cursor-zoom-in"
                                                >
                                                    <img
                                                        src={imageUrl}
                                                        alt={`Screenshot captured at ${formatTime(
                                                            screenshot.capturedAt
                                                        )}`}
                                                        className="aspect-video w-full object-cover"
                                                    />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => loadScreenshotUrl(screenshot.id)}
                                                    disabled={loadingScreenshot === screenshot.id}
                                                    className="flex aspect-video w-full items-center justify-center bg-zinc-500 text-black hover:bg-gray-200 disabled:opacity-50"
                                                >
                                                    {loadingScreenshot === screenshot.id
                                                        ? "Loading..."
                                                        : "📸 View Screenshot"}
                                                </button>
                                            )}

                                            <div className="p-4">
                                                <p className="font-medium">
                                                    {screenshot.application ||
                                                        "Unknown application"}
                                                </p>

                                                {screenshot.website && (
                                                    <p className="text-sm text-white">
                                                        {screenshot.website}
                                                    </p>
                                                )}

                                                <p className="mt-2 text-xs text-white">
                                                    {formatTime(screenshot.capturedAt)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
            </div>

            {selectedScreenshot &&
                screenshotUrls[selectedScreenshot.id] && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
                        onClick={() => setSelectedScreenshot(null)}
                    >
                        <div
                            className="relative max-h-[95vh] max-w-[95vw]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => setSelectedScreenshot(null)}
                                className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-1 text-xl text-white hover:bg-black"
                            >
                                ×
                            </button>

                            <img
                                src={screenshotUrls[selectedScreenshot.id]}
                                alt={`Screenshot captured at ${formatTime(
                                    selectedScreenshot.capturedAt
                                )}`}
                                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                            />

                            <div className="mt-2 text-center text-sm text-white">
                                {selectedScreenshot.application || "Unknown application"}

                                {selectedScreenshot.website && (
                                    <> · {selectedScreenshot.website}</>
                                )}

                                {" · "}
                                {formatTime(selectedScreenshot.capturedAt)}
                            </div>
                        </div>
                    </div>
                )}

        </main>
    );


}