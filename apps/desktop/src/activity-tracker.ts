import {
  getActiveWindow,
} from "./active-window.js";

const API_URL =
  "http://localhost:3000/api/activities";

type ProjectIdGetter =
  () => string | null;

type Activity = {
  application: string;
  windowTitle: string | null;
  startedAt: Date;
  endedAt: Date;
};

async function isTrackingEnabled(token: string) {
  try {
    const response = await fetch(
      "http://localhost:3000/api/settings/privacy",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      console.error(
        "Privacy API returned:",
        response.status,
      );

      return false;
    }

    const data = await response.json();

    return data.settings?.trackingEnabled === true;
  } catch (error) {
    console.error(
      "Could not check tracking permission:",
      error,
    );

    return false;
  }
}

export function startActivityTracker(
  getProjectId: ProjectIdGetter,
  getToken: () => string | null,
) {
  let currentActivity: Activity | null =
    null;

  let previousWindowKey = "";

  async function poll() {
    try {
      const token = getToken();

      if (!token) {
        console.log("Desktop is not paired.");
        return;
      }

      const trackingEnabled = await isTrackingEnabled(token);

      if (!trackingEnabled) {
        /*
         * Stop the current session if tracking
         * was disabled while an activity was running.
         */
        if (currentActivity) {
          const now = new Date();

          currentActivity.endedAt =
            now;

          await saveActivity(
            currentActivity,
            getProjectId(),
            token,
          );

          currentActivity = null;
          previousWindowKey = "";
        }

        return;
      }

      const activeWindow =
        await getActiveWindow();

      if (!activeWindow) {
        return;
      }

      const windowKey =
        `${activeWindow.application}:${activeWindow.windowTitle}`;

      /*
       * Nothing changed.
       */
      if (windowKey === previousWindowKey) {
        return;
      }

      const now = new Date();

      /*
       * Save previous activity
       */
      if (currentActivity) {
        currentActivity.endedAt = now;

        await saveActivity(
          currentActivity,
          getProjectId(),
          token,
        );
      }

      /*
       * Start new activity
       */
      currentActivity = {
        application:
          activeWindow.application,

        windowTitle:
          activeWindow.windowTitle,

        startedAt: now,

        endedAt: now,
      };

      previousWindowKey = windowKey;

      console.log(
        "Activity started:",
        currentActivity,
      );

    } catch (error) {
      console.error(
        "Activity tracker error:",
        error,
      );
    }
  }

  /*
   * Poll every 2 seconds.
   */
  setInterval(poll, 2000);

  /*
   * Run immediately.
   */
  poll();
}

async function saveActivity(
  activity: Activity,
  projectId: string | null,
  token: string,
) {
  try {
    /*
     * Ignore extremely short activities.
     */
    const duration =
      activity.endedAt.getTime() -
      activity.startedAt.getTime();

    if (duration < 1000) {
      return;
    }

    console.log(
      "Saving activity:",
      {
        ...activity,
        projectId,
      },
    );

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        application:
          activity.application,

        windowTitle:
          activity.windowTitle,

        startedAt:
          activity.startedAt.toISOString(),

        endedAt:
          activity.endedAt.toISOString(),

        projectId,
      }),
    });

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Activity API error:",
        data,
      );

      return;
    }

    console.log(
      "Activity saved:",
      data,
    );

  } catch (error) {
    console.error(
      "Could not save activity:",
      error,
    );
  }
}