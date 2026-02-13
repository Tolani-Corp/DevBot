import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const stats = [
    { name: 'Active Tasks', value: '12', change: '+2', changeType: 'positive' },
    { name: 'PRs Created', value: '4', change: '+1', changeType: 'positive' },
    { name: 'Success Rate', value: '98.5%', change: '-0.2%', changeType: 'negative' },
]

const recentActivity = [
    { id: 1, type: 'task', message: 'Refactored auth module', time: '1h ago', status: 'completed', icon: CheckCircleIcon, iconColor: 'text-green-500' },
    { id: 2, type: 'pr', message: 'Created PR #104: Fix login bug', time: '2h ago', status: 'pending', icon: ArrowPathIcon, iconColor: 'text-yellow-500' },
    { id: 3, type: 'alert', message: 'Build failed on feature/ui-update', time: '4h ago', status: 'failed', icon: ExclamationTriangleIcon, iconColor: 'text-red-500' },
]

export default function DashboardPage() {
    return (
        <div>
            <h1 className="text-2xl font-semibold leading-6 text-zinc-900 dark:text-white">Overview</h1>

            {/* Stats Grid */}
            <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                {stats.map((item) => (
                    <div key={item.name} className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-zinc-800 dark:ring-1 dark:ring-white/10">
                        <dt className="truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{item.name}</dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">{item.value}</dd>
                        <dd className={`mt-2 text-sm ${item.changeType === 'positive' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {item.change} since last week
                        </dd>
                    </div>
                ))}
            </dl>

            {/* Activity Feed */}
            <h2 className="mt-10 text-lg font-medium text-zinc-900 dark:text-white">Recent Activity</h2>
            <div className="mt-4 flow-root">
                <ul role="list" className="-mb-8">
                    {recentActivity.map((event, eventIdx) => (
                        <li key={event.id}>
                            <div className="relative pb-8">
                                {eventIdx !== recentActivity.length - 1 ? (
                                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
                                ) : null}
                                <div className="relative flex space-x-3">
                                    <div>
                                        <span className={`h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center ring-8 ring-white dark:ring-zinc-900`}>
                                            <event.icon className={`h-5 w-5 ${event.iconColor}`} aria-hidden="true" />
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
    )
}
