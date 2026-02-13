import { Sidebar } from '@/components/app/Sidebar'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="h-full bg-slate-50 dark:bg-zinc-900">
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
