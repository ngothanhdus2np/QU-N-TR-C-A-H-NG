/**
 * Error Tracking Service
 * 
 * Centralized error tracking and monitoring.
 * Ready for Sentry integration when needed.
 */

interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

class ErrorTrackingService {
  private isProduction = process.env.NODE_ENV === 'production';
  private sentryEnabled = false; // Set to true when Sentry is configured

  /**
   * Initialize error tracking (Sentry, etc.)
   */
  init(): void {
    if (this.sentryEnabled && process.env.SENTRY_DSN) {
      // TODO: Initialize Sentry when ready
      // import * as Sentry from '@sentry/node';
      // Sentry.init({
      //   dsn: process.env.SENTRY_DSN,
      //   environment: process.env.NODE_ENV,
      //   tracesSampleRate: 1.0,
      // });
      console.log('[ErrorTracking] Sentry initialized');
    } else {
      console.log('[ErrorTracking] Using console logging (Sentry not configured)');
    }
  }

  /**
   * Capture an error
   */
  captureError(error: Error, context?: ErrorContext): void {
    if (this.sentryEnabled) {
      // TODO: Send to Sentry
      // Sentry.captureException(error, { contexts: { custom: context } });
    }

    // Always log to console
    console.error('[ERROR]', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Capture a message (non-error event)
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    if (this.sentryEnabled) {
      // TODO: Send to Sentry
      // Sentry.captureMessage(message, { level, contexts: { custom: context } });
    }

    // Log to console
    const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logFn(`[${level.toUpperCase()}]`, message, context);
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (this.sentryEnabled) {
      // TODO: Set Sentry user
      // Sentry.setUser(user);
    }
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (this.sentryEnabled) {
      // TODO: Clear Sentry user
      // Sentry.setUser(null);
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
    if (this.sentryEnabled) {
      // TODO: Add Sentry breadcrumb
      // Sentry.addBreadcrumb({ message, category, data });
    }

    if (!this.isProduction) {
      console.log('[BREADCRUMB]', { message, category, data });
    }
  }
}

// Singleton instance
export const errorTracking = new ErrorTrackingService();

// Initialize on import
errorTracking.init();

/**
 * Express error handler middleware
 */
export const errorHandler = (err: Error, req: any, res: any, next: any) => {
  errorTracking.captureError(err, {
    action: `${req.method} ${req.path}`,
    metadata: {
      body: req.body,
      query: req.query,
      params: req.params,
    },
  });

  // Don't expose error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

/**
 * React error boundary helper
 */
export const logReactError = (error: Error, errorInfo: { componentStack: string }) => {
  errorTracking.captureError(error, {
    action: 'React Error Boundary',
    metadata: {
      componentStack: errorInfo.componentStack,
    },
  });
};
