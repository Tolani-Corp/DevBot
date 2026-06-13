import clsx from "clsx";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase text-cyan-600 dark:text-cyan-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatGrid({
  stats,
}: {
  stats: Array<{
    name: string;
    value: string;
    change: string;
    tone?: "positive" | "warning" | "danger" | "neutral";
  }>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((item) => (
        <div
          key={item.name}
          className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-800"
        >
          <dt className="truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {item.name}
          </dt>
          <dd className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-white">
            {item.value}
          </dd>
          <dd
            className={clsx(
              "mt-2 text-sm",
              item.tone === "warning"
                ? "text-amber-600 dark:text-amber-300"
                : item.tone === "danger"
                  ? "text-red-600 dark:text-red-400"
                  : item.tone === "neutral"
                    ? "text-zinc-500 dark:text-zinc-400"
                    : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {item.change}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "positive" | "warning" | "danger" | "info" | "neutral";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "positive"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
          : tone === "warning"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
            : tone === "danger"
              ? "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"
              : tone === "info"
                ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
      <div
        className="h-full rounded-full bg-cyan-500"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
