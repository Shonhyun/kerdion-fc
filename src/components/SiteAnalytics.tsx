'use client';

import { Analytics } from '@vercel/analytics/next';

/**
 * Vercel Web Analytics: anonymous page-visit counts, no cookies.
 * Query strings are removed before anything is sent, so sign-in codes or other values in a URL
 * never reach the analytics service.
 */
export default function SiteAnalytics() {
  return <Analytics beforeSend={(e) => ({ ...e, url: e.url.split('?')[0].split('#')[0] })} />;
}
