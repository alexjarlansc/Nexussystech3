import React from 'react';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface RouteErrorBoundaryState { error: Error | null }

export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  private retry = () => {
    this.setState({ error: null });
    // força recarregar chunk tentando nova navegação
    if (window.location.pathname === '/erp') {
      window.location.href = '/erp';
    }
  };

  render() {
    if (this.state.error) {
      return this.props.fallback || (
        <div className="p-6 text-sm text-red-600 space-y-3">
          <p><strong>Falha ao carregar módulo.</strong></p>
          <pre className="text-xs whitespace-pre-wrap bg-red-50 border border-red-200 p-2 rounded max-h-40 overflow-auto">{this.state.error.message}</pre>
          <button onClick={this.retry} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Tentar novamente</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;