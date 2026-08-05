
import { useEffect } from 'react';

const SITE_URL = 'https://noon-library-2026.vercel.app';

const DEFAULT_TITLE = 'مكتبة نون | كتب وروايات عربية';

const DEFAULT_DESCRIPTION =
  'مكتبة نون للكتب والروايات العربية. اكتشف آلاف الكتب في الأدب والروايات والعلوم والتاريخ والفلسفة والتعليم، مع شحن لجميع محافظات مصر.';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  noIndex?: boolean;
  canonical?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
}

export function SEO({
  title,
  description,
  image = `${SITE_URL}/og-image.jpg`,
  type = 'website',
  noIndex = false,
  canonical,
  structuredData,
}: SEOProps) {
  useEffect(() => {
    const finalTitle = title
      ? `${title} | مكتبة نون`
      : DEFAULT_TITLE;

    const finalDescription = description || DEFAULT_DESCRIPTION;

    document.title = finalTitle;

    const setMeta = (
      attribute: 'name' | 'property',
      key: string,
      content: string
    ) => {
      let element = document.head.querySelector(
        `meta[${attribute}="${key}"]`
      ) as HTMLMetaElement | null;

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    };

    const setCanonical = (url: string) => {
      let canonicalElement = document.head.querySelector(
        'link[rel="canonical"]'
      ) as HTMLLinkElement | null;

      if (!canonicalElement) {
        canonicalElement = document.createElement('link');
        canonicalElement.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalElement);
      }

      canonicalElement.setAttribute('href', url);
    };

    // Basic SEO
    setMeta('name', 'description', finalDescription);

    setMeta(
      'name',
      'robots',
      noIndex ? 'noindex, nofollow' : 'index, follow'
    );

    // Open Graph
    setMeta('property', 'og:title', finalTitle);
    setMeta('property', 'og:description', finalDescription);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', 'مكتبة نون');
    setMeta('property', 'og:locale', 'ar_EG');
    setMeta('property', 'og:image', image);

    // Twitter / X
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', finalTitle);
    setMeta('name', 'twitter:description', finalDescription);
    setMeta('name', 'twitter:image', image);

    // Canonical
    setCanonical(canonical || SITE_URL);

    // Remove previous structured data
    document.head
      .querySelectorAll('script[data-seo-structured-data]')
      .forEach((element) => element.remove());

    // Add structured data
    if (structuredData) {
      const script = document.createElement('script');

      script.type = 'application/ld+json';
      script.setAttribute('data-seo-structured-data', 'true');

      script.textContent = JSON.stringify(structuredData);

      document.head.appendChild(script);
    }
  }, [
    title,
    description,
    image,
    type,
    noIndex,
    canonical,
    structuredData,
  ]);

  return null;
}

