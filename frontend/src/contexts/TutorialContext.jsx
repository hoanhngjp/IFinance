import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from 'react';
import { useUser } from './UserContext';
import { desktopSteps, mobileSteps } from '../tutorial/tutorialSteps';
import { waitForElement } from '../utils/waitForElement';
import { tutorialAnalytics } from '../utils/tutorialAnalytics';

// ─── Lazy-load react-joyride so it's excluded from the main bundle ───────────
// The component is only ever rendered while a tutorial is active.
const Joyride = lazy(() =>
  import('react-joyride').then((mod) => ({ default: mod.Joyride }))
);

// ─── Inline Joyride string constants ─────────────────────────────────────────
// Defined here so we don't need a top-level import of react-joyride
// (which would defeat the purpose of lazy-loading the component).
const J_STATUS = { FINISHED: 'finished', SKIPPED: 'skipped' };
const J_EVENTS = { STEP_AFTER: 'step:after', TARGET_NOT_FOUND: 'error:target_not_found' };
const J_ACTIONS = { PREV: 'prev', CLOSE: 'close' };

const MOBILE_BREAKPOINT = 1024; // matches Tailwind `lg:`

const TutorialContext = createContext(null);

// ─── Joyride v3 options (functional settings, replaces styles.options) ────────
const JOYRIDE_OPTIONS = {
  primaryColor: '#4f46e5',
  backgroundColor: '#ffffff',
  overlayColor: 'rgba(15, 23, 42, 0.45)',
  zIndex: 10000,
  buttons: ['back', 'close', 'primary', 'skip'], // include skip button
  showProgress: true,
};

// ─── Joyride visual theme (matches indigo-600 brand) ─────────────────────────
// In v3, styles.overlay.backgroundColor controls overlay color;
// primaryColor/zIndex/etc. live in the `options` prop above.
const JOYRIDE_STYLES = {
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  tooltip: {
    borderRadius: '14px',
    padding: '20px 24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  tooltipTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '8px',
  },
  tooltipContent: {
    fontSize: '14px',
    color: '#64748b',
    lineHeight: '1.6',
  },
  buttonPrimary: {
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    padding: '8px 18px',
  },
  buttonBack: {
    color: '#6b7280',
    fontSize: '13px',
    marginRight: 8,
  },
  buttonSkip: {
    color: '#9ca3af',
    fontSize: '13px',
  },
  buttonClose: {
    color: '#9ca3af',
  },
};

const JOYRIDE_LOCALE = {
  back: 'Quay lại',
  close: 'Đóng',
  last: 'Hoàn thành',
  next: 'Tiếp theo',
  nextWithProgress: 'Tiếp theo ({current}/{total})',
  open: 'Mở hộp thoại',
  skip: 'Bỏ qua',
};

// ─────────────────────────────────────────────────────────────────────────────

export function TutorialProvider({ children }) {
  const { user, updatePreferences } = useUser();

  // Joyride controlled state
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState([]);
  const [joyrideActive, setJoyrideActive] = useState(false); // controls Suspense mount

  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  // Refs — used inside callbacks to avoid stale closures
  const isRunningRef = useRef(false);
  const stepIndexRef = useRef(0);
  const isMobileRef = useRef(isMobile);

  const syncRef = (ref, val) => { ref.current = val; };

  useEffect(() => syncRef(stepIndexRef, stepIndex), [stepIndex]);
  useEffect(() => syncRef(isMobileRef, isMobile), [isMobile]);

  // ── Responsive breakpoint handler ──────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const nowMobile = window.innerWidth < MOBILE_BREAKPOINT;
      if (nowMobile === isMobileRef.current) return; // no change

      const prevSteps = isMobileRef.current ? mobileSteps : desktopSteps;
      const nextSteps = nowMobile ? mobileSteps : desktopSteps;
      const currentKey = prevSteps[stepIndexRef.current]?.key;

      syncRef(isMobileRef, nowMobile);
      setIsMobile(nowMobile);

      if (!isRunningRef.current) return;

      // Map current step to the equivalent step in the other breakpoint set
      const nextIdx = nextSteps.findIndex((s) => s.key === currentKey);
      setRun(false);
      setSteps(nextSteps);

      if (nextIdx >= 0) {
        setStepIndex(nextIdx);
        syncRef(stepIndexRef, nextIdx);
        // Small delay lets DOM settle after layout shift
        setTimeout(() => setRun(true), 150);
      } else {
        // No matching step on new breakpoint — safe pause at step 0
        setStepIndex(0);
        syncRef(stepIndexRef, 0);
        // Don't resume; user can replay via startTutorial()
        isRunningRef.current = false;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // intentionally empty — uses refs only

  // ── Auto-start for new users ───────────────────────────────────────────────
  useEffect(() => {
    if (!user || isRunningRef.current) return;

    // Prefer localStorage as source of truth for "already seen" to handle
    // the case where the user completed the tutorial but the API sync
    // failed — we don't want to re-show the tour on next login.
    const localKey = `tutorial_seen_${user.user_id}`;
    const seenLocally = localStorage.getItem(localKey) === 'true';

    if (!user.has_seen_tutorial && !seenLocally) {
      startTutorial();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Stop tour immediately when user logs out ───────────────────────────────
  useEffect(() => {
    if (!user && isRunningRef.current) {
      stopTutorial();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Core lifecycle functions ───────────────────────────────────────────────

  const startTutorial = useCallback(() => {
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    const activeSteps = mobile ? mobileSteps : desktopSteps;

    syncRef(isMobileRef, mobile);
    syncRef(stepIndexRef, 0);

    setIsMobile(mobile);
    setSteps(activeSteps);
    setStepIndex(0);
    setJoyrideActive(true); // mount Joyride via Suspense
    setRun(true);
    isRunningRef.current = true;

    tutorialAnalytics.stepView(activeSteps[0]?.key, 0);
  }, []);

  const stopTutorial = useCallback(() => {
    setRun(false);
    setJoyrideActive(false);
    isRunningRef.current = false;
  }, []);

  const completeTutorial = useCallback(async () => {
    stopTutorial();
    tutorialAnalytics.complete();
    await updatePreferences({ has_seen_tutorial: true });
  }, [stopTutorial, updatePreferences]);

  const skipTutorial = useCallback(async () => {
    const idx = stepIndexRef.current;
    stopTutorial();
    tutorialAnalytics.skip(idx);
    await updatePreferences({ has_seen_tutorial: true });
  }, [stopTutorial, updatePreferences]);

  // ── Joyride controlled callback ────────────────────────────────────────────
  //
  // We run Joyride in fully controlled mode (we own stepIndex).
  // Flow when user clicks Next / Prev:
  //   1. STEP_AFTER fires  →  pause Joyride (run = false)
  //   2. Wait for target element to appear in DOM (waitForElement)
  //   3. Advance stepIndex  →  resume (run = true)
  //
  // If an element is never found we skip it (or complete if it's the last step).
  const handleCallback = useCallback(
    async (data) => {
      const { action, index, status, type } = data;

      // ── Terminal states ────────────────────────────────────────────────────
      if (status === J_STATUS.FINISHED) {
        await completeTutorial();
        return;
      }
      if (status === J_STATUS.SKIPPED || action === J_ACTIONS.CLOSE) {
        await skipTutorial();
        return;
      }

      // ── Step navigation ────────────────────────────────────────────────────
      if (type === J_EVENTS.STEP_AFTER || type === J_EVENTS.TARGET_NOT_FOUND) {
        const delta = action === J_ACTIONS.PREV ? -1 : 1;
        const nextIndex = index + delta;

        // Boundary: completing last step
        if (nextIndex >= steps.length) {
          await completeTutorial();
          return;
        }
        if (nextIndex < 0) return;

        const nextStep = steps[nextIndex];
        if (!nextStep) return;

        // Pause while we verify/wait for the next target element
        setRun(false);

        try {
          if (nextStep.target !== 'body') {
            await waitForElement(nextStep.target, { timeout: 3000, retries: 1 });
          }
          // Element confirmed — advance the tour
          setStepIndex(nextIndex);
          syncRef(stepIndexRef, nextIndex);
          setRun(true);
          tutorialAnalytics.stepView(nextStep.key, nextIndex);
        } catch {
          // Element not found after retries — skip this step gracefully
          if (nextIndex < steps.length - 1) {
            setStepIndex(nextIndex + 1);
            syncRef(stepIndexRef, nextIndex + 1);
            setRun(true);
          } else {
            await completeTutorial();
          }
        }
      }
    },
    [steps, completeTutorial, skipTutorial],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TutorialContext.Provider value={{ run, stepIndex, steps, isMobile, startTutorial }}>
      {children}

      {/* Joyride is only mounted while the tour is active — lazy-loaded. */}
      {joyrideActive && (
        <Suspense fallback={null}>
          <Joyride
            steps={steps}
            run={run}
            stepIndex={stepIndex}
            continuous
            scrollToFirstStep={false}
            onEvent={handleCallback}
            options={JOYRIDE_OPTIONS}
            styles={JOYRIDE_STYLES}
            locale={JOYRIDE_LOCALE}
          />
        </Suspense>
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within <TutorialProvider>');
  return ctx;
}
