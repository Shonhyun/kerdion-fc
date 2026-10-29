import Link from 'next/link';
import { LogoMark } from '@/components/Logo';

/** Public pages anyone can read without signing in: Privacy Policy and Terms. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-wrap">
      <header className="legal-head">
        <Link className="brand" href="/"><LogoMark /><span className="brand-name">Saffra</span></Link>
      </header>
      <main className="legal">{children}</main>
      <footer className="legal-foot">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Use</Link>
        <Link href="/">Back to Saffra</Link>
      </footer>
    </div>
  );
}
