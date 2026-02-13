import { Header } from '@/components/Header'

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
                {children}
            </main>
            <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-12 text-center text-sm text-[var(--text-secondary)]">
                &copy; 2026 DevBot AI. All rights reserved.
            </footer>
        </div>
    )
}
