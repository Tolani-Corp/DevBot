import Link from 'next/link'
import clsx from 'clsx'
import {
    HomeIcon,
    CommandLineIcon,
    CpuChipIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline'

const navigation = [
    { name: 'Overview', href: '/dashboard', icon: HomeIcon, current: true },
    { name: 'Tasks', href: '/dashboard/tasks', icon: CommandLineIcon, current: false },
    { name: 'Agents', href: '/dashboard/agents', icon: CpuChipIcon, current: false },
    { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon, current: false },
]

export function Sidebar({ className }: { className?: string }) {
    return (
        <div className={clsx("flex flex-col gap-y-5 bg-white px-6 pb-4 dark:bg-zinc-900", className)}>
            <div className="flex h-16 shrink-0 items-center">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500 flex items-center justify-center text-white">
                        DB
                    </div>
                    <span className="text-zinc-950 dark:text-white">DevBot</span>
                </Link>
            </div>
            <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                        <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className={clsx(
                                            item.current
                                                ? 'bg-zinc-50 text-cyan-600 dark:bg-zinc-800 dark:text-cyan-400'
                                                : 'text-zinc-700 hover:text-cyan-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800',
                                            'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6'
                                        )}
                                    >
                                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </li>
                    {/* Teams section could go here */}
                    <li className="mt-auto">
                        <Link
                            href="/dashboard/profile"
                            className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-zinc-700 hover:bg-zinc-50 hover:text-cyan-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                            <div className="h-6 w-6 rounded-full bg-gray-500" /> {/* Avatar Placeholder */}
                            User Profile
                        </Link>
                        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <a
                                href="https://tolanilabs.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-zinc-500 hover:text-cyan-500 transition-colors italic flex items-center gap-1"
                            >
                                Built by <span className="font-bold">Tolani Labs</span>
                            </a>
                        </div>
                    </li>
                </ul>
            </nav>
        </div>
    )
}
