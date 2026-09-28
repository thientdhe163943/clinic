import { AuthBrand } from '@/components/shared/auth-brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/60 to-secondary/40 p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-secondary/50 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(24,99,191,0.08)_1px,transparent_0)] [background-size:32px_32px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-6">
        <AuthBrand />
        {children}
      </div>
    </main>
  );
}
