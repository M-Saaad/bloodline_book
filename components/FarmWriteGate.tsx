import type { ReactNode } from 'react';

import { useFarmRole } from '@/hooks/useFarmRole';

export function FarmWriteGate({ children }: { children: ReactNode }) {
  const { canWrite } = useFarmRole();
  if (!canWrite) {
    return null;
  }
  return children;
}
