import { useState, useEffect, useCallback } from 'react';

export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');

  useEffect(() => {
    const onChange = () => {
      setRoute(window.location.hash.slice(1) || '/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return { route, navigate };
}

export function parseRoute(route: string): { page: string; params: Record<string, string> } {
  const clean = route.split('?')[0];
  const parts = clean.split('/').filter(Boolean);

  if (parts.length === 0) return { page: 'home', params: {} };

  if (parts[0] === 'book' && parts[1]) return { page: 'book', params: { id: parts[1] } };
  if (parts[0] === 'category' && parts[1]) return { page: 'category', params: { slug: parts[1] } };
  if (parts[0] === 'search') return { page: 'search', params: {} };
  if (parts[0] === 'cart') return { page: 'cart', params: {} };
  if (parts[0] === 'checkout') return { page: 'checkout', params: {} };
  if (parts[0] === 'login') return { page: 'login', params: {} };
  if (parts[0] === 'signup') return { page: 'signup', params: {} };
  if (parts[0] === 'profile') return { page: 'profile', params: {} };
  if (parts[0] === 'orders') return { page: 'orders', params: {} };
  if (parts[0] === 'order' && parts[1]) return { page: 'order', params: { id: parts[1] } };
  if (parts[0] === 'wishlist') return { page: 'wishlist', params: {} };
  if (parts[0] === 'addresses') return { page: 'addresses', params: {} };
  if (parts[0] === 'notifications') return { page: 'notifications', params: {} };
  if (parts[0] === 'affiliate') return { page: 'affiliate', params: {} };
  if (parts[0] === 'affiliate-register') return { page: 'affiliate-register', params: {} };
  if (parts[0] === 'ref' && parts[1]) return { page: 'home', params: { ref: parts[1] } };
  if (parts[0] === 'admin') return { page: 'admin', params: {} };
  if (parts[0] === 'about') return { page: 'about', params: {} };
  if (parts[0] === 'contact') return { page: 'contact', params: {} };
  if (parts[0] === 'tickets') return { page: 'tickets', params: {} };
  if (parts[0] === 'ticket' && parts[1]) return { page: 'ticket', params: { id: parts[1] } };
  if (parts[0] === 'return-policy') return { page: 'return-policy', params: {} };
  if (parts[0] === 'offers') {
    if (parts[1]) return { page: 'offer', params: { slug: parts[1] } };
    return { page: 'offers', params: {} };
  }

  return { page: 'home', params: {} };
}

export function getQueryParam(route: string, key: string): string | null {
  const qIndex = route.indexOf('?');
  if (qIndex === -1) return null;
  const params = new URLSearchParams(route.slice(qIndex + 1));
  return params.get(key);
}
