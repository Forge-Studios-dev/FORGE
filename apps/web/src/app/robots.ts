import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/studio',
        '/studio/*',
        '/upload',
        '/settings',
        '/settings/*',
        '/messages',
        '/messages/*',
        '/login',
        '/signup',
        '/verify-email',
        '/forgot-password',
        '/reset-password',
        '/waiting-approval',
        '/approval-rejected',
        '/auth/*',
        '/impersonate',
        '/session-expired',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
