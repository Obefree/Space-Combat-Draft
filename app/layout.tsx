import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Space Combat Draft — боевой прототип",
  description:
    "Hot-seat прототип космической боевой системы с личными кубами кораблей и резервом карт.",
  openGraph: {
    title: "Space Combat Draft",
    description:
      "Играбельный прототип космического боя: 3 корабля на старте, 2 подкрепления и отдельный пул кубов у каждого игрока.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Space Combat Draft",
    description:
      "Играбельный прототип космического боя с личными кубами кораблей.",
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
