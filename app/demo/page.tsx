'use client';

import { useEffect, useState } from 'react';
import App from '@/components/App';
import { enableDemoMode } from '@/lib/demo-mode';
import { resetDemoStore } from '@/lib/demo-store';

export default function DemoPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    resetDemoStore();
    enableDemoMode();
    setReady(true);
  }, []);

  if (!ready) return null;

  return <App />;
}
