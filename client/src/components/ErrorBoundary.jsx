import { Component } from 'react';

// Catches render/handler errors so a bug shows a recoverable message instead
// of unmounting the whole tree (which can look like the page "refreshing").
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-red-200 shadow-sm p-6 text-center">
            <h2 className="font-semibold text-slate-800 mb-1">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {String(this.state.error.message || this.state.error)}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
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
