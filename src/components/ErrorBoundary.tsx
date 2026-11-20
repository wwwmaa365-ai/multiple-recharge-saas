import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected system error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let parsedError: Record<string, unknown> | null = null;
      try {
        parsedError = JSON.parse(this.state.errorMessage);
      } catch {
        parsedError = null;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold font-display">Security or System Exception</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              The operation was halted by tenant isolation or permission validation rules.
            </p>
            {parsedError ? (
              <pre className="text-xs font-mono bg-slate-100 dark:bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-800 dark:text-slate-200 mb-4">
                {JSON.stringify(parsedError, null, 2)}
              </pre>
            ) : (
              <div className="text-xs font-mono bg-slate-100 dark:bg-slate-950 p-3 rounded-lg text-slate-800 dark:text-slate-200 mb-4">
                {this.state.errorMessage}
              </div>
            )}
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-indigo-600 rounded-lg hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
