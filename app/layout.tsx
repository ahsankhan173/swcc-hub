import './globals.css';

export const metadata = {
  title: 'SWCC Hub',
  description: 'South Woodford Cricket Club Hub'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
