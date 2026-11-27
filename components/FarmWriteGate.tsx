import type { ReactNode } from 'react';

import { useFarmRole } from '@/hooks/useFarmRole';

export function FarmWriteGate({ children }: { children: ReactNode }) {
  const { canWrite, isRolePending } = useFarmRole();
  if (isRolePending || !canWrite) {
    return null;
  }
  return children;
}
