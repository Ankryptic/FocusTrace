import { json } from "node:stream/consumers";
import { ActiveWindow, getActiveWindow } from "./active-window.js";

type ActivitySession = {
    application: string;
    windowTitle: string;
    processId: number;
    startedAt: Date;
    endedAt: Date;
};

let currentActivity: ActivitySession | null = null;

function sameWindow(
    a: ActivitySession,
    b: ActiveWindow,
) {
    return (
        a.application === b.application &&
        a.windowTitle === b.windowTitle &&
        a.processId === b.processId
    );
}

function startActivity(window: ActiveWindow) {
    currentActivity = {
        application: window.application,
        windowTitle: window.windowTitle,
        processId: window.processId,
        startedAt: new Date(),
        endedAt: new Date()
    };

    console.log("\n▶ Activity started");
    console.log(currentActivity);
}

async function saveActivity(activity: ActivitySession) {
    const res = await fetch("http://localhost:3000/api/activities", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            application: activity.application,
            windowTitle: activity.windowTitle,
            processId: activity.processId,
            startedAt: activity.startedAt.toISOString(),
            endedAt: activity.endedAt.toISOString()
        }),
    });

    if (!res.ok) {
        const error = await res.text();

        throw new Error(`Activity API Failed (${res.status}): ${error}`);
    }

    const result = await res.json();

    console.log("✓ Activity saved");
    console.log(result);
}

async function stopActivity() {
    if (!currentActivity) {
        return;
    }

    currentActivity.endedAt = new Date();

    const duration = Math.floor(
        (currentActivity.endedAt.getTime() - currentActivity.startedAt.getTime()) / 1000
    );

    console.log("\n■ Activity stopped");
    console.log({
        ...currentActivity,
        durationSeconds: duration,
    });

    try {
        await saveActivity(currentActivity)
    } catch (error) {
        console.error("Failed to save activity: ", error);
    }

    currentActivity = null;
}

export function startActivityTracker() {
    console.log("FocusTrace Activity Tracker Started")

    setInterval(async () => {
        try {
            const activeWindow = await getActiveWindow()

            if (!activeWindow) {
                return;
            }

            if (!currentActivity) {
                startActivity(activeWindow);
                return;
            }

            if (!sameWindow(currentActivity, activeWindow)) {
                stopActivity();
                startActivity(activeWindow);
            }

        } catch (error) {
            console.error("Activity Tracking Failed: ", error);
        }
    }, 2000);
}