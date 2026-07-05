import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

// Top-level safety net: a throw in any descendant renders a recoverable
// fallback instead of unmounting the whole app to a blank white screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('Uncaught render error:', error, info);
    this.setState({ componentStack: info?.componentStack ?? null });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-gray-100 dark:bg-gray-900 p-6 text-center">
          <div className="text-4xl">😵</div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md break-words">
            {this.state.error.message}
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Reload
          </button>
          {(this.state.error.stack || this.state.componentStack) && (
            <details className="max-w-2xl w-full text-left mt-2">
              <summary className="cursor-pointer text-xs text-gray-400 dark:text-gray-500">
                Details (stack trace)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-snug text-gray-500 dark:text-gray-400 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg p-3">
                {this.state.error.stack}
                {this.state.componentStack ? `\n\nComponent stack:${this.state.componentStack}` : ''}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
