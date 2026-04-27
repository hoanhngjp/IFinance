/**
 * Wait for a DOM element matching `selector` to appear.
 *
 * Uses MutationObserver scoped to the app root (#root or document.body)
 * rather than the full document, minimizing observation overhead.
 *
 * @param {string} selector - CSS selector to wait for
 * @param {object} [options]
 * @param {number} [options.timeout=5000]  - Max ms to wait per attempt
 * @param {number} [options.retries=1]     - Extra attempts after first timeout
 * @param {Element} [options.root]         - Observation scope (default: #root)
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, { timeout = 5000, retries = 1, root } = {}) {
  const observeRoot = root || document.getElementById('root') || document.body;

  const attempt = (retriesLeft) =>
    new Promise((resolve, reject) => {
      // Fast-path: element already exists
      const found = document.querySelector(selector);
      if (found) return resolve(found);

      let observer = null;

      const timer = setTimeout(() => {
        observer?.disconnect();
        if (retriesLeft > 0) {
          attempt(retriesLeft - 1).then(resolve).catch(reject);
        } else {
          reject(new Error(`[waitForElement] "${selector}" not found within ${timeout}ms`));
        }
      }, timeout);

      observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(observeRoot, { childList: true, subtree: true });
    });

  return attempt(retries);
}
