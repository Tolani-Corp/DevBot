import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const stats = [
  {
    name: "Governance Gates",
    value: "8",
    change: "required",
    changeType: "positive",
  },
  {
    name: "Offline Bundle Files",
    value: "158",
    change: "checksummed",
    changeType: "positive",
  },
  {
    name: "Mirror Entries",
    value: "4",
    change: "license-gated",
    changeType: "positive",
  },
];

const recentActivity = [
  {
    id: 1,
    message: "Offline NATT bundle ADR and design review linked",
    time: "governance evidence",
    icon: CheckCircleIcon,
    iconColor: "text-green-500",
  },
  {
    id: 2,
    message:
      "External mirrors require license approval, SBOM, checksums, and ROE",
    time: "policy gate",
    icon: ShieldCheckIcon,
    iconColor: "text-cyan-500",
  },
  {
    id: 3,
    message: "Deployment workflow emits a reviewed deployment intent artifact",
    time: "release gate",
    icon: ArrowPathIcon,
    iconColor: "text-yellow-500",
  },
  {
    id: 4,
    message:
      "Live NATT operations remain guarded by explicit operator approval",
    time: "high-risk control",
    icon: ExclamationTriangleIcon,
    iconColor: "text-red-500",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold leading-6 text-zinc-900 dark:text-white">
        Overview
      </h1>

      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.name}
            className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-zinc-800 dark:ring-1 dark:ring-white/10"
          >
            <dt className="truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {item.name}
            </dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              {item.value}
            </dd>
            <dd
              className={`mt-2 text-sm ${item.changeType === "positive" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {item.change}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-lg font-medium text-zinc-900 dark:text-white">
        Commercial Readiness Evidence
      </h2>
      <div className="mt-4 flow-root">
        <ul role="list" className="-mb-8">
          {recentActivity.map((event, eventIdx) => (
            <li key={event.id}>
              <div className="relative pb-8">
                {eventIdx !== recentActivity.length - 1 ? (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-zinc-200 dark:bg-zinc-700"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-8 ring-white dark:bg-zinc-800 dark:ring-zinc-900">
                      <event.icon
                        className={`h-5 w-5 ${event.iconColor}`}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {event.message}
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-zinc-500 dark:text-zinc-400">
                      <time dateTime={event.time}>{event.time}</time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
