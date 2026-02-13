import { ThemeProvider } from '@/components/ThemeProvider'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/app/Sidebar'
import './globals.css'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="flex min-h-screen flex-col bg-[var(--bg-page)] text-[var(--text-primary)] antialiased transition-colors duration-300">
                <ThemeProvider>
                    {/* Header is global, but Sidebar is usually only for the app layout. 
                We'll clean this up in the app layout if needed, but here we provide the ThemeProvider wrapper. */}
                    {children}
                </ThemeProvider>
            </body>
        </html>
    )
}
