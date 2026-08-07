import { useEffect } from 'react';
import { useSettings } from './settings';

interface SeoOptions {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  canonicalPath?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noIndex?: boolean;
}

const SITE_ORIGIN = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}` : '';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]) {
  const scriptId = `jsonld-${id}`;
  let el = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = scriptId;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSeo({ title, description, image, type = 'website', canonicalPath, jsonLd, noIndex }: SeoOptions) {
  const { settings } = useSettings();
  const siteName = settings.site_name || 'مكتبة نون';
  const defaultImage = `${SITE_ORIGIN}/og-default.jpg`;
  const ogImage = image || defaultImage;
  const canonical = canonicalPath ? `${SITE_ORIGIN}/#${canonicalPath}` : SITE_ORIGIN;

  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
      upsertMeta('name', 'twitter:description', description);
    }

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:site_name', siteName);
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:image', ogImage);

    upsertLink('canonical', canonical);

    if (noIndex) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
    } else {
      upsertMeta('name', 'robots', 'index, follow');
    }

    if (jsonLd) {
      upsertJsonLd(type, jsonLd);
    } else {
      const el = document.getElementById(`jsonld-${type}`);
      if (el) el.remove();
    }
  }, [title, description, image, type, canonicalPath, jsonLd, noIndex, siteName, ogImage, canonical]);
}

export { SITE_ORIGIN };
