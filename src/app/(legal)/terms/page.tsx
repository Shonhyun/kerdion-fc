import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '../legal';

export const metadata: Metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  const mail = <a href={'mailto:' + LEGAL.email}>{LEGAL.email}</a>;
  return (
    <article>
      <h1>Terms of Use</h1>
      <p className="legal-date">Effective {LEGAL.effective}</p>
      <p>
        These terms apply when you use Saffra, a food costing and profit planning web app operated by {LEGAL.operator},{' '}
        {LEGAL.location} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using Saffra, you agree to these terms
        and to our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please do not use Saffra.
      </p>

      <h2>1. Saffra is in beta</h2>
      <ul>
        <li>Saffra is free while it is in beta. Features may change, be added or be removed, and you may find bugs.</li>
        <li>We may offer paid plans in the future. We will tell you before any paid plan starts, and we will never charge you unless you choose a paid plan yourself.</li>
      </ul>

      <h2>2. Your account</h2>
      <ul>
        <li>Give a real email address you can access, and keep your password private.</li>
        <li>You are responsible for what happens under your account. Tell us right away if you think someone else has used it.</li>
        <li>You must be at least 18 years old to create an account.</li>
      </ul>

      <h2>3. Your data stays yours</h2>
      <ul>
        <li>The products, prices, expenses, sales and other information you enter belong to you.</li>
        <li>You allow us to store and process that information only to run Saffra for you, as described in the <Link href="/privacy">Privacy Policy</Link>.</li>
        <li>Please download a backup from time to time from <strong>Export &amp; backup</strong>, especially before big changes.</li>
      </ul>

      <h2>4. The numbers are estimates</h2>
      <p>
        Saffra calculates costs, suggested prices, profit and break-even points from the numbers you enter. Results are only as
        accurate as those numbers. They are estimates to help you decide, not financial, accounting, tax or legal advice. You are
        responsible for your own pricing and business decisions.
      </p>

      <h2>5. Fair use</h2>
      <p>When using Saffra, you agree not to:</p>
      <ul>
        <li>use it for anything illegal;</li>
        <li>try to access other people&rsquo;s accounts or data, or get around its security;</li>
        <li>overload, disrupt or attack the service, including with bots or automated scraping;</li>
        <li>copy, resell or rebrand Saffra or its design as your own.</li>
      </ul>

      <h2>6. Availability</h2>
      <p>We work to keep Saffra running and your data safe, but we cannot promise it will always be available or free of errors. It may be down at times for maintenance or because of problems with our providers.</p>

      <h2>7. Stopping or closing an account</h2>
      <ul>
        <li>You can stop using Saffra at any time. To delete your account and data, email {mail} from your account&rsquo;s email address.</li>
        <li>We may suspend or close an account that breaks these terms or puts other users or the service at risk. Where reasonable, we will tell you first and give you a chance to download your data.</li>
      </ul>

      <h2>8. Limits of our responsibility</h2>
      <p>
        Saffra is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not responsible for indirect losses such as lost
        profits, lost sales or business interruption that come from using or not being able to use Saffra, or from decisions based
        on its results. Nothing in these terms removes rights you have under Philippine consumer protection laws.
      </p>

      <h2>9. Changes to these terms</h2>
      <p>We may update these terms as Saffra grows. We will change the date above, and for important changes we will tell you in the app or by email before they take effect. Using Saffra after that means you accept the new terms.</p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of the Philippines.</p>

      <h2>11. Contact us</h2>
      <p>Questions about these terms: {mail}.</p>
    </article>
  );
}
