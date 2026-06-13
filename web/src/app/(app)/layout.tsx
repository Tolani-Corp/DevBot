import Link from 'next/link'
import { DeboLogo } from '@/components/DeboLogo'
import { Sidebar } from '@/components/app/Sidebar'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="h-full bg-slate-50 dark:bg-zinc-900">
            <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-white/10 dark:bg-zinc-900 lg:hidden">
                <Link href="/" className="font-bold">
                    <DeboLogo />
                </Link>
                <Link
                    href="/dashboard"
                    className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-white"
                >
                    Console
                </Link>
            </header>
            <div className="flex h-full">
                <Sidebar className="hidden lg:block lg:w-72 lg:shrink-0 lg:border-r lg:border-zinc-950/5 dark:lg:border-white/10" />
                <main className="flex-1 overflow-y-auto min-h-screen">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
