export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-8">
      {/* Geometric background accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-96 w-96 rotate-45 rounded-3xl bg-blue/5" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rotate-12 rounded-3xl bg-blue/3" />
        <div className="absolute left-1/2 top-1/4 h-px w-64 -translate-x-1/2 rotate-12 bg-white/5" />
        <div className="absolute left-1/3 top-2/3 h-px w-48 rotate-[-15deg] bg-white/5" />
      </div>

      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
