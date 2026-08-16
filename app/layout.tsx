import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Space Combat Draft — боевой прототип",
  description:
    "Hot-seat прототип космической боевой системы: симметричные колоды по 10 карт, случайные 5 перед боем и общий пул кубов у каждого игрока.",
  openGraph: {
    title: "Space Combat Draft",
    description:
      "Играбельный прототип космического боя: колоды по 10 карт, случайные 5 перед боем, 3 корабля на старте и отдельный пул кубов у каждого игрока.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Space Combat Draft",
    description:
      "Играбельный прототип космического боя с симметричными колодами и пулами кубов игроков.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#15121d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
