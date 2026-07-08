import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const ibmArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const naskh = Noto_Naskh_Arabic({
  variable: "--font-naskh",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "مكان — اكتشف الأردن",
  description:
    "خريطة الأردن الذكية: مطلات، أودية، شلالات، مسارات، كافيهات وأماكن مخفية — بمساعد ذكاء اصطناعي يعرف كل مكان.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${ibmArabic.variable} ${naskh.variable} h-full antialiased`}
    >
      <head>
        <script
          // Apply saved theme + language before paint (defaults: dark, Arabic RTL)
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("makan_theme");if(t!=="light")document.documentElement.classList.add("dark");var l=localStorage.getItem("makan_lang");if(l==="en"){document.documentElement.lang="en";document.documentElement.dir="ltr"}}catch(e){document.documentElement.classList.add("dark")}})()',
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LangProvider>
          {children}
          <Toaster position="bottom-center" />
        </LangProvider>
      </body>
    </html>
  );
}
