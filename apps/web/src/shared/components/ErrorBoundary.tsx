import React from 'react'

type Props = { children: React.ReactNode }
type State = { error: Error | null }

// Class component required — React has no hook equivalent for error boundaries.
// This catches rendering errors in the subtree and shows a recovery UI instead of a blank page.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production this would pipe to Sentry / DataDog
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-center p-8">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-sm">{this.state.error.message}</p>
          <button
            className="px-4 py-2 text-sm rounded-md border hover:bg-muted"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
