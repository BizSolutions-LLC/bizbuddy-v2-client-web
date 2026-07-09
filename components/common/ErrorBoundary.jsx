"use client";

import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-orange-50 dark:bg-orange-950/20">
              <AlertTriangle className="h-10 w-10 text-orange-500" />
            </div>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred in this section. Your other data is safe.
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="text-left text-xs bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 overflow-auto max-h-40 text-red-600 dark:text-red-400">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={this.handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
