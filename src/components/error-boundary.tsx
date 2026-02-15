'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  traceId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      traceId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate a trace ID for this error
    const traceId = `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
    return { hasError: true, error, traceId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // In production, you would send this to your logging service
    // logErrorToService(error, errorInfo, this.state.traceId);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportBug = () => {
    const { error, traceId } = this.state;
    const subject = encodeURIComponent(`Error Report: ${traceId}`);
    const body = encodeURIComponent(`
Error ID: ${traceId}
Message: ${error?.message}
Stack: ${error?.stack}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Time: ${new Date().toISOString()}
    `);
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Our team has been notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Trace ID */}
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">Error ID</p>
                <p className="font-mono font-medium">{this.state.traceId}</p>
              </div>

              {/* Error Message (development only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {this.state.error.message}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-1 font-mono whitespace-pre-wrap overflow-x-auto max-h-40">
                    {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleReload} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
                <Button variant="ghost" onClick={this.handleReportBug} className="w-full">
                  <Bug className="h-4 w-4 mr-2" />
                  Report this issue
                </Button>
              </div>

              {/* Help text */}
              <p className="text-xs text-center text-muted-foreground">
                If this problem persists, please contact support with the Error ID above.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping pages
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

// Async error boundary for catching promise rejections
export class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, traceId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const traceId = `ASYNC-${Date.now().toString(36)}`.toUpperCase();
    return { hasError: true, error, traceId };
  }

  componentDidMount() {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    this.setState({
      hasError: true,
      error,
      traceId: `ASYNC-${Date.now().toString(36)}`.toUpperCase(),
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorBoundary>
          <div className="min-h-screen flex items-center justify-center">
            <p>An error occurred while loading data. Please refresh the page.</p>
          </div>
        </ErrorBoundary>
      );
    }

    return this.props.children;
  }
}
