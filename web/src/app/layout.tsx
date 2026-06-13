import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://debo.ai"),
  title: "DEBO | AI Dashboard And Workstation",
  description:
    "DEBO is the AI dashboard and workstation for guided journeys, approvals, trust posture, learner progress, operator review, and the reviewed DEBO Unchained lane.",
  applicationName: "DEBO",
  alternates: {
    canonical: "https://debo.ai/",
  },
  openGraph: {
    title: "DEBO | AI Dashboard And Workstation",
    url: "https://debo.ai/",
    description:
      "Guided journeys, approvals, learner progress, trust posture, and reviewed escalation in one workstation.",
    images: ["/assets/brand.svg"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/assets/brand.svg"],
  },
  icons: {
    icon: [
      { url: "/assets/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: [{ url: "/assets/favicon.ico", sizes: "32x32" }],
    apple: [{ url: "/assets/apple-touch-icon.png" }],
    other: [
      {
        rel: "mask-icon",
        url: "/assets/safari-pinned-tab.svg",
        color: "#35ff7a",
      },
    ],
  },
  manifest: "/assets/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#35ff7a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} ${spaceGrotesk.className} min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
