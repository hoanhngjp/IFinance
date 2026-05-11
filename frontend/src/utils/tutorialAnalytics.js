// Chỉ log trong dev, chưa kết nối analytics thật
function send(eventName, payload = {}) {
  if (import.meta.env.DEV) {
    console.log('[Tutorial Analytics]', eventName, { ...payload, ts: Date.now() });
  }
}

export const tutorialAnalytics = {
  stepView: (stepKey, stepIndex) =>
    send('tutorial_step_view', { step_key: stepKey, step_index: stepIndex }),

  complete: () => send('tutorial_complete'),

  skip: (atStepIndex) =>
    send('tutorial_skip', { at_step_index: atStepIndex }),
};
