"use client"

import Link from 'next/link'
import { useState } from 'react'
import { useTheme } from './ThemeProvider'
import { SunIcon, MoonIcon, Bars3Icon, XMarkIcon, CommandLineIcon } from '@heroicons/react/24/outline'

const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Agents', href: '/agents' },
    { name: 'Deployments', href: '/deployments' },
    { name: 'Settings', href: '/settings' },
]

export function Header() {
    const { theme, setTheme } = useTheme()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <header className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-page)]/80 backdrop-blur-xl">
            <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
                <div className="flex lg:flex-1">
                    <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white">
                            <CommandLineIcon className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-[var(--text-primary)]">Debo</span>
                    </Link>
                </div>

                <div className="hidden lg:flex lg:gap-x-8">
                    {navigation.map((item) => (
                        <Link key={item.name} href={item.href} className="text-sm font-medium leading-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            {item.name}
                        </Link>
                    ))}
                </div>

                <div className="flex flex-1 items-center justify-end gap-x-4">
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="rounded-full p-2 hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                    >
                        {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                    </button>

                    <div className="hidden lg:block h-6 w-px bg-[var(--border-subtle)]" />

                    <Link
                        href="/dashboard"
                        className="hidden lg:block rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                    >
                        Launch Console
                    </Link>

                    <button
                        type="button"
                        className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-[var(--text-secondary)] lg:hidden"
                        onClick={() => setMobileMenuOpen(true)}
                    >
                        <span className="sr-only">Open main menu</span>
                        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                    </button>
                </div>
            </nav>

            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-50 bg-[var(--bg-page)] p-6">
                    <div className="flex items-center justify-between mb-8">
                        <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
                            <span className="font-bold text-[var(--text-primary)]">Debo</span>
                        </Link>
                        <button
                            type="button"
                            className="-m-2.5 rounded-md p-2.5 text-[var(--text-secondary)]"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <span className="sr-only">Close menu</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </header>
    )
}
