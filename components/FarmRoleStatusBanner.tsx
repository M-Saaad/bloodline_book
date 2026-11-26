import { View } from 'react-native';

import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Banner } from '@/components/ui/Banner';
import { useFarmRole } from '@/hooks/useFarmRole';

/** View-only when role is hand; permission check spinner state while role is still loading. */
export function FarmRoleStatusBanner() {
  const { isRolePending, showReadOnlyBanner } = useFarmRole();

  if (isRolePending) {
    return (
      <View className="mb-4">
        <Banner
          tone="blue"
          title="Checking permissions…"
          message="Your access on this farm is loading from this phone."
        />
      </View>
    );
  }

  if (showReadOnlyBanner) {
    return <ReadOnlyFarmBanner />;
  }

  return null;
}