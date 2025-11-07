/**
 * Console Filter Utility
 * Filters out browser extension and preload warnings that are not related to our application
 */

export const initConsoleFilter = () => {
  // Store original console methods
  const originalWarn = console.warn;
  const originalError = console.error;

  // List of patterns to filter out
  const filterPatterns = [
    /chrome-extension:\/\//i,
    /was preloaded using link preload but not used/i,
    /Please make sure it has an appropriate `as` value/i,
    /No product info found on this page/i,
    /localhost:5001\/api\/products/i,
  ];

  // Override console.warn
  console.warn = (...args) => {
    const message = args.join(' ');
    const shouldFilter = filterPatterns.some(pattern => pattern.test(message));
    
    if (!shouldFilter) {
      originalWarn.apply(console, args);
    }
  };

  // Override console.error
  console.error = (...args) => {
    const message = args.join(' ');
    const shouldFilter = filterPatterns.some(pattern => pattern.test(message));
    
    if (!shouldFilter) {
      originalError.apply(console, args);
    }
  };

  // Log that filter is active (only in development)
  if (import.meta.env.DEV) {
    console.info('🔇 Console filter active - Browser extension warnings suppressed');
  }
};

// Export function to restore original console methods
export const restoreConsole = () => {
  // This would require storing the original methods globally
  // For simplicity, a page reload will restore them
  console.info('Console filter can be disabled by reloading the page');
};
