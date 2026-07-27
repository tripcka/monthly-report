import "./globals.css";

export const metadata = {
  title: "TRIPICKA 마케팅 운영 보고서",
  description: "호텔별 월간 마케팅 운영 보고서 생성기",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
