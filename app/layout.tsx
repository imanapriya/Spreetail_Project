import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Expenses App",
  description: "Track flat expenses beautifully",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
