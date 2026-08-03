import { type ReactNode, type MouseEvent, useCallback } from 'react';
import { useHashRoute } from '@/lib/router';

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  activeClassName?: string;
}

export function Link({ to, children, className = '', onClick, activeClassName = '' }: LinkProps) {
  const { route, navigate } = useHashRoute();
  const isActive = route === to || (to !== '/' && route.startsWith(to));

  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    onClick?.(e);
    navigate(to);
  }, [navigate, onClick, to]);

  return (
    <a href={`#${to}`} className={`${className} ${isActive ? activeClassName : ''}`} onClick={handleClick}>
      {children}
    </a>
  );
}
