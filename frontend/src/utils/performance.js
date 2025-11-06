/**
 * Performance Monitoring Utility
 * 
 * This utility helps monitor and optimize the performance of your application.
 * It tracks page load times, API calls, and user interactions.
 */

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = () => {
  if ('performance' in window) {
    // Log initial page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        const connectTime = perfData.responseEnd - perfData.requestStart;
        const renderTime = perfData.domComplete - perfData.domLoading;

        console.log('Performance Metrics:', {
          pageLoadTime: `${pageLoadTime}ms`,
          connectTime: `${connectTime}ms`,
          renderTime: `${renderTime}ms`
        });

        // Track in analytics if available
        if (window.gtag) {
          window.gtag('event', 'page_performance', {
            page_load_time: pageLoadTime,
            connect_time: connectTime,
            render_time: renderTime
          });
        }
      }, 0);
    });
  }

  // Track Core Web Vitals
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
      
      if (window.gtag) {
        window.gtag('event', 'web_vitals', {
          metric_name: 'LCP',
          value: Math.round(lastEntry.renderTime || lastEntry.loadTime),
          metric_rating: lastEntry.renderTime < 2500 ? 'good' : lastEntry.renderTime < 4000 ? 'needs-improvement' : 'poor'
        });
      }
    });
    
    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP observation not supported');
    }

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fid = entry.processingStart - entry.startTime;
        console.log('FID:', fid);
        
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            metric_name: 'FID',
            value: Math.round(fid),
            metric_rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor'
          });
        }
      });
    });

    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID observation not supported');
    }

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      console.log('CLS:', clsValue);
      
      if (window.gtag && clsValue > 0) {
        window.gtag('event', 'web_vitals', {
          metric_name: 'CLS',
          value: clsValue,
          metric_rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor'
        });
      }
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('CLS observation not supported');
    }
  }
};

/**
 * Track API call performance
 * 
 * @param {string} endpoint - API endpoint
 * @param {number} startTime - Request start time
 * @param {number} endTime - Request end time
 * @param {boolean} success - Whether the request was successful
 */
export const trackAPIPerformance = (endpoint, startTime, endTime, success = true) => {
  const duration = endTime - startTime;
  
  console.log(`API Call: ${endpoint} - ${duration}ms - ${success ? 'Success' : 'Failed'}`);
  
  if (window.gtag) {
    window.gtag('event', 'api_performance', {
      endpoint: endpoint,
      duration: duration,
      success: success,
      performance_rating: duration < 1000 ? 'good' : duration < 3000 ? 'average' : 'slow'
    });
  }
};

/**
 * Create an API performance tracker wrapper
 * Use this to wrap your API calls
 * 
 * @example
 * const data = await trackAPICall('/api/students', () => axios.get('/api/students'));
 */
export const trackAPICall = async (endpoint, apiCall) => {
  const startTime = performance.now();
  try {
    const result = await apiCall();
    const endTime = performance.now();
    trackAPIPerformance(endpoint, startTime, endTime, true);
    return result;
  } catch (error) {
    const endTime = performance.now();
    trackAPIPerformance(endpoint, startTime, endTime, false);
    throw error;
  }
};

/**
 * Track component render time
 * 
 * @param {string} componentName - Name of the component
 * @param {number} renderTime - Render time in milliseconds
 */
export const trackComponentRender = (componentName, renderTime) => {
  console.log(`Component Render: ${componentName} - ${renderTime}ms`);
  
  if (window.gtag) {
    window.gtag('event', 'component_performance', {
      component_name: componentName,
      render_time: renderTime
    });
  }
};

/**
 * React Hook for tracking component performance
 * 
 * @example
 * function MyComponent() {
 *   usePerformanceTracking('MyComponent');
 *   return <div>Content</div>;
 * }
 */
export const usePerformanceTracking = (componentName) => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const startTime = performance.now();
    
    // Track on mount
    React.useEffect(() => {
      const mountTime = performance.now() - startTime;
      trackComponentRender(componentName, mountTime);
    }, [componentName, startTime]);
  }
};

/**
 * Monitor memory usage (if available)
 */
export const getMemoryUsage = () => {
  if (performance.memory) {
    const memory = performance.memory;
    return {
      usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
    };
  }
  return null;
};

/**
 * Log memory usage
 */
export const logMemoryUsage = () => {
  const memory = getMemoryUsage();
  if (memory) {
    console.log('Memory Usage:', memory);
    
    if (window.gtag) {
      window.gtag('event', 'memory_usage', {
        used_heap: memory.usedJSHeapSize,
        total_heap: memory.totalJSHeapSize
      });
    }
  }
};

/**
 * Get network information
 */
export const getNetworkInfo = () => {
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }
  return null;
};

/**
 * Detect slow network and adjust behavior
 */
export const isSlowNetwork = () => {
  const networkInfo = getNetworkInfo();
  if (networkInfo) {
    return networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g';
  }
  return false;
};

/**
 * Create a performance report
 */
export const generatePerformanceReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    memory: getMemoryUsage(),
    network: getNetworkInfo(),
  };

  if ('performance' in window) {
    const perfData = window.performance.timing;
    report.loadTimes = {
      pageLoad: perfData.loadEventEnd - perfData.navigationStart,
      domReady: perfData.domContentLoadedEventEnd - perfData.navigationStart,
      firstPaint: perfData.responseStart - perfData.navigationStart
    };

    // Get resource timing
    const resources = performance.getEntriesByType('resource');
    report.resources = {
      count: resources.length,
      totalSize: resources.reduce((acc, resource) => acc + (resource.transferSize || 0), 0),
      slowest: resources
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(r => ({ name: r.name, duration: r.duration }))
    };
  }

  return report;
};

/**
 * Export performance data
 */
export const exportPerformanceData = () => {
  const report = generatePerformanceReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `performance-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Setup periodic performance monitoring
 * 
 * @param {number} interval - Monitoring interval in milliseconds (default: 60000 = 1 minute)
 */
export const setupPeriodicMonitoring = (interval = 60000) => {
  setInterval(() => {
    logMemoryUsage();
    
    const networkInfo = getNetworkInfo();
    if (networkInfo) {
      console.log('Network Info:', networkInfo);
    }
  }, interval);
};

export default {
  initPerformanceMonitoring,
  trackAPIPerformance,
  trackAPICall,
  trackComponentRender,
  getMemoryUsage,
  logMemoryUsage,
  getNetworkInfo,
  isSlowNetwork,
  generatePerformanceReport,
  exportPerformanceData,
  setupPeriodicMonitoring
};
