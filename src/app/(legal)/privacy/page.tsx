import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '../legal';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  const mail = <a href={'mailto:' + LEGAL.email}>{LEGAL.email}</a>;
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="legal-date">Effective {LEGAL.effective}</p>
      <p>
        This policy explains what information Saffra collects, why, and what you can do about it. Saffra is a food costing and
        profit planning web app operated by {LEGAL.operator}, {LEGAL.location} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). We follow
        the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We collect only what Saffra needs to work: your email, your password (stored scrambled), your business name and the business numbers you type in.</li>
        <li>Your business data is private to your account. Other users cannot see it.</li>
        <li>We do not sell your data, show ads, or use advertising or analytics trackers.</li>
        <li>You can download your data any time and ask us to delete your account.</li>
      </ul>

      <h2>1. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account details:</strong> your email address and password. Passwords are stored as a secure hash by our login provider, so no one, including us, can read them.</li>
        <li><strong>Business details:</strong> your business name and everything you enter in the app, such as products, ingredients and their prices, packaging, sizes, add-ons, monthly expenses, sales plans, daily sales logs, goals and settings.</li>
        <li><strong>Messages and feedback:</strong> anything you send us by email or chat, for example beta feedback.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>Sign-in cookies:</strong> small cookies that keep you signed in. They are required for the app to work and are not used for tracking.</li>
        <li><strong>Data saved in your browser:</strong> a copy of your business data, so the app opens quickly and keeps unsaved changes if your connection drops, plus your Light/Dark choice. It stays on your device until you sign out or clear your browser.</li>
        <li><strong>Technical logs:</strong> our hosting and database providers automatically record basic request details, such as IP address, browser type and time, to run and secure their services.</li>
      </ul>
      <p>We do not collect payment details. Saffra is free during the beta.</p>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To run Saffra: compute your costs, prices and profit, and save and sync your data across your devices.</li>
        <li>To send account emails, such as sign-up confirmation and password reset links.</li>
        <li>To keep Saffra secure, prevent abuse and fix problems.</li>
        <li>To improve Saffra, using the feedback you choose to send us.</li>
      </ul>
      <p>We do not use your business numbers for anything else, and we do not sell, rent or trade your information.</p>

      <h2>3. Who else handles your data</h2>
      <p>We use a few trusted service providers to run Saffra. They process data only to provide their service to us:</p>
      <ul>
        <li><strong>Supabase</strong>: account sign-in, account emails and the database that stores your business data.</li>
        <li><strong>Vercel</strong>: hosting of the web app.</li>
        <li><strong>Google Fonts</strong>: the app&rsquo;s fonts load from Google&rsquo;s servers, which receive your IP address when the page loads.</li>
      </ul>
      <p>These providers may store data on servers outside the Philippines. We may also share information if the law requires it.</p>

      <h2>4. How we protect your data</h2>
      <ul>
        <li>All connections to Saffra use HTTPS encryption.</li>
        <li>Database rules make sure each signed-in account can read and change only its own business data.</li>
        <li>Passwords are never stored in readable form.</li>
      </ul>
      <p>No online service can be perfectly secure. If we learn of a breach that affects your personal data, we will notify you and the National Privacy Commission as the law requires.</p>

      <h2>5. How long we keep it</h2>
      <p>
        We keep your account and business data while your account is active. If you ask us to delete your account, we delete your
        account and business data within 30 days. Copies in our providers&rsquo; backups are removed on their regular backup schedule.
      </p>

      <h2>6. Your rights</h2>
      <p>Under the Data Privacy Act you have the right to:</p>
      <ul>
        <li>be informed about how your data is used (this policy);</li>
        <li>access your data and get a copy of it: use <strong>Export &amp; backup</strong> in the app, or ask us;</li>
        <li>correct your data: you can edit everything in the app;</li>
        <li>object to processing, and have your data deleted or blocked;</li>
        <li>data portability, through the Excel and backup files in the app;</li>
        <li>claim damages, and file a complaint with the <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">National Privacy Commission</a>.</li>
      </ul>
      <p>To use any of these rights or to delete your account, email {mail} from the email address of your account.</p>

      <h2>7. Who Saffra is for</h2>
      <p>Saffra is made for business owners and their staff. It is not meant for children, and we do not knowingly collect data from anyone under 18.</p>

      <h2>8. Changes to this policy</h2>
      <p>If we change this policy, we will update the date above. If the change is important, we will also tell you in the app or by email before it takes effect.</p>

      <h2>9. Contact us</h2>
      <p>Questions or requests about your privacy: {mail}.</p>
      <p>See also our <Link href="/terms">Terms of Use</Link>.</p>
    </article>
  );
}
