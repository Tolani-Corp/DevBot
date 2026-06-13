"use client"

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

function isTheme(value: string | null): value is Theme {
    return value === 'dark' || value === 'light' || value === 'system'
}

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'system'

    const savedTheme = localStorage.getItem('theme')
    return isTheme(savedTheme) ? savedTheme : 'system'
}

const ThemeContext = createContext<{
    theme: Theme
    setTheme: (theme: Theme) => void
}>({
    theme: 'system',
    setTheme: () => null,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(getInitialTheme)

    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove('light', 'dark')

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
            root.classList.add(systemTheme)
            root.setAttribute('data-theme', systemTheme)
        } else {
            root.classList.add(theme)
            root.setAttribute('data-theme', theme)
        }
        localStorage.setItem('theme', theme)
    }, [theme])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
