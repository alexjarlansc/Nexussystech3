import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";

export default function AI() {
  return (
  <div className="min-h-svh gradient-hero" style={{ paddingTop: 'var(--header-height)' }}>
      <NexusProtectedHeader />
      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">API de IA</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Em breve: integrações e assistentes inteligentes para sua operação.
        </p>
      </main>
    </div>
  );
}
