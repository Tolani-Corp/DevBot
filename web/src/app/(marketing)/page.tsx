import Link from 'next/link'
import { CommandLineIcon, CpuChipIcon, BoltIcon } from '@heroicons/react/24/outline'

export default function Home() {
    return (
        <div className="relative isolate pt-14">
            {/* Radiant Background Effect */}
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
                <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }} />
            </div>

            <div className="py-24 sm:py-32 lg:pb-40">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-6xl">
                            Your AI <span className="text-gradient">Engineering Team</span>
                        </h1>
                        <p className="mt-6 text-lg leading-8 text-[var(--text-secondary)]">
                            DevBot autonomously plans, codes, and deploys full-stack applications.
                            Stop writing boilerplate. Start shipping products.
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-x-6">
                            <Link href="/dashboard" className="rounded-md bg-[var(--color-primary)] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
                                Start Building
                            </Link>
                            <Link href="/demo" className="text-sm font-semibold leading-6 text-[var(--text-primary)]">
                                Live Demo <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </div>

                    <div className="mt-16 flow-root sm:mt-24">
                        <div className="surface-card p-2 rounded-xl bg-[var(--bg-surface)]/50 ring-1 ring-[var(--border-subtle)] lg:-m-4 lg:rounded-2xl lg:p-4">
                            <div className="rounded-md bg-[var(--bg-page)] shadow-2xl ring-1 ring-[var(--border-subtle)] overflow-hidden">
                                {/* Mock Terminal Interface */}
                                <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span className="ml-2 text-xs text-[var(--text-secondary)] font-mono">devbot-terminal — zsh</span>
                                </div>
                                <div className="p-6 font-mono text-sm">
                                    <div className="flex gap-2 text-green-400">
                                        <span>➜</span>
                                        <span className="text-[var(--text-primary)]">devbot create "SaaS Platform"</span>
                                    </div>
                                    <div className="text-[var(--text-secondary)] mt-2">
                                        <span>Analysis complete. Generating architecture...</span><br />
                                        <span>Creating Next.js 15 app...</span><br />
                                        <span>Configuring Tailwind v4...</span><br />
                                        <span className="text-green-400">✓ Project initialized successfully.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
