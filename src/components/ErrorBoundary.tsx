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
    try {
      // Snapshot rápido dos filhos do body para entender quais Portals/elementos existem
      const snapshot = Array.from(document.body.children).map((c) => ({
        tag: c.tagName,
        id: (c as HTMLElement).id || undefined,
        class: (c as HTMLElement).className || undefined,
        outerHTMLLength: c.outerHTML ? c.outerHTML.length : 0,
      }));
      console.debug('ErrorBoundary: document.body children snapshot:', snapshot);

      // Buscar possíveis Portals/Dialogs (Radix/Reach/Role=dialog)
      const portalNodes = Array.from(document.querySelectorAll('[data-radix-portal], [data-reach-dialog], [role="dialog"], .radix-portal'))
        .map(n => ({ tag: (n as HTMLElement).tagName, id: (n as HTMLElement).id || undefined, class: (n as HTMLElement).className || undefined, outerHTMLLength: (n as HTMLElement).outerHTML?.length || 0 }));
      console.debug('ErrorBoundary: possible portal/dialog nodes:', portalNodes);
    } catch (e) {
      console.debug('ErrorBoundary: failed to capture DOM snapshot', e);
    }
    // Patch Node.prototype.removeChild once (dev only) to log detailed diagnostics
    try {
      const w = window as any;
      if (!w.__removeChildPatched) {
        const orig = Node.prototype.removeChild;
        Node.prototype.removeChild = function(child: Node) {
          try {
            return orig.call(this, child);
          } catch (err) {
            try {
              const parent = this as HTMLElement;
              const childInfo = child && child.nodeType ? {
                nodeName: (child as HTMLElement).nodeName,
                id: (child as HTMLElement).id || undefined,
                className: (child as HTMLElement).className || undefined,
                outerHTMLSnippet: ((child as HTMLElement).outerHTML || '').slice(0, 300)
              } : child;
              const parentChildren = parent && parent.children ? Array.from(parent.children).map(c => ({ nodeName: c.nodeName, id: (c as HTMLElement).id || undefined, className: (c as HTMLElement).className || undefined })) : [];
              console.error('removeChild PATCH ERROR: parent:', parent, 'child:', childInfo, 'parentChildren:', parentChildren, 'originalError:', err, '\nstack:', new Error().stack);
            } catch (inner) {
              console.error('removeChild PATCH failed to introspect nodes', inner);
            }
            throw err;
          }
        };
        w.__removeChildPatched = true;
        console.debug('ErrorBoundary: Node.prototype.removeChild patched for diagnostics');
      }
    } catch (e) {
      console.debug('ErrorBoundary: failed to patch removeChild', e);
    }
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