import Link from "next/link";
import "./globals.css";

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center p-8">
        <div className="text-center">
          <p className="display text-7xl">404</p>
          <p className="mt-4 text-lg">This page doesn&apos;t exist.</p>
          <Link className="btn btn-primary mt-8" href="/">Go to LeafCheckup</Link>
        </div>
      </body>
    </html>
  );
}
