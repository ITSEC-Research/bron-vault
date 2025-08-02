"use client";

import React from "react";
import { logError } from "@/lib/logger";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  context?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const context = this.props.context || 'ErrorBoundary';

    // Log error with proper context
    logError(
      `${context} caught an error: ${error.message}`,
      {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId
      },
      context
    );

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-red-600 text-sm mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.errorId && (
              <p className="text-red-500 text-xs mb-4 font-mono">
                Error ID: {this.state.errorId}
              </p>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: undefined, errorId: undefined })}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
