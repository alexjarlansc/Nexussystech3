import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary capturou um erro:', error, errorInfo);
  }

  private handleReload = () => {
    // Clear any corrupted auth state
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Reload the page
    window.location.href = '/auth';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 card-elevated text-center">
            <h2 className="text-xl font-bold text-destructive mb-4">
              Oops! Algo deu errado
            </h2>
            <p className="text-muted-foreground mb-6">
              Ocorreu um erro inesperado. Vamos tentar recuperar o sistema.
            </p>
            <div className="space-y-2">
              <Button onClick={this.handleReload} className="w-full">
                Recarregar Sistema
              </Button>
              <Button 
                variant="outline" 
                onClick={() => this.setState({ hasError: false })}
                className="w-full"
              >
                Tentar Novamente
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Detalhes técnicos
                </summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}