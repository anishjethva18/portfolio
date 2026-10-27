import React from 'react';
import { RefreshCw, Power } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught Windows 11 OS Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[99999] bg-[#0078d7] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-xl w-full flex flex-col items-start gap-6">
            <div className="text-8xl font-light">:(</div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold">Your Windows 11 Web OS ran into a problem</h1>
              <p className="text-white/80 text-sm sm:text-base leading-relaxed">
                We're just collecting some error info, and then you can restart your session cleanly.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-xs font-mono text-white/90 overflow-x-auto max-h-40">
                <p className="font-bold text-red-200">Stop Code: CRITICAL_PROCESS_DIED</p>
                <p className="mt-1">{this.state.error.toString()}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 w-full pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-white/90 active:scale-95 transition-all shadow-lg cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Restart OS Now
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium text-sm active:scale-95 transition-all border border-white/20 cursor-pointer"
              >
                <Power className="w-4 h-4" />
                Clear State & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
