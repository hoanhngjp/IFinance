/**
 * Tutorial analytics event emitter.
 *
 * Currently logs to console in development.
 * To connect a real service, replace the `send` function body with:
 *   window.analytics?.track(eventName, payload)   // Segment
 *   gtag('event', eventName, payload)              // GA4
 *   posthog.capture(eventName, payload)            // PostHog
 */

function send(eventName, payload = {}) {
  if (import.meta.env.DEV) {
    console.log('[Tutorial Analytics]', eventName, { ...payload, ts: Date.now() });
  }
  // TODO: plug in your analytics provider here
}

export const tutorialAnalytics = {
  /** Fired each time a step becomes visible */
  stepView: (stepKey, stepIndex) =>
    send('tutorial_step_view', { step_key: stepKey, step_index: stepIndex }),

  /** Fired when user completes the full tutorial */
  complete: () => send('tutorial_complete'),

  /** Fired when user skips the tutorial */
  skip: (atStepIndex) =>
    send('tutorial_skip', { at_step_index: atStepIndex }),
};
