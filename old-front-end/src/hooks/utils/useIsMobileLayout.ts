import { useEffect, useState } from 'react';

export function useIsMobileLayout(breakpoint = 991.98) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query: MediaQueryList = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const update = (e?: MediaQueryListEvent) => setIsMobile(e?.matches ?? query.matches);

    update();

    // Modern browsers
    if (query.addEventListener) {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }

    // Fallback legacy
    query.addListener(update);
    return () => query.removeListener(update);
  }, [breakpoint]);

  return isMobile;
}