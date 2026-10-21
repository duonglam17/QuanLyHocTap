export function StatusMessage({ title, children, role = 'status' }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6" role={role}>
      <h2 className="font-medium">{title}</h2>
      {children ? <p className="mt-2 text-sm text-muted-foreground">{children}</p> : null}
    </section>
  );
}
