export const metadata = {
  title: 'Suki Halal',
  description: 'ระบบสั่งอาหารบุฟเฟต์ Suki Halal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: 'sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
