import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exert — Everything Exert is building",
  description: "Simple tools, systems, and projects built to make things easy.",
  openGraph: {
    title: "Exert",
    description: "Simple tools, systems, and projects built to make things easy.",
    type: "website",
    url: "https://exert.ca"
  },
  metadataBase: new URL("https://exert.ca")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
