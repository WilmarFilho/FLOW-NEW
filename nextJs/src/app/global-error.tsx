'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { logger } from '../lib/logger.api';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry and our centralized backend logger
    Sentry.captureException(error);
    logger.error('Unhandled Global Error', error, { digest: error.digest });
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong!</h2>
          <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
