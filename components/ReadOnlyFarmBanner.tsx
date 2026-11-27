import { View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { VIEW_ONLY_FARM_MESSAGE } from '@/lib/domain/farm-role-access';

export function ReadOnlyFarmBanner() {
  return (
    <View className="mb-4">
      <Banner tone="blue" title="View only" message={VIEW_ONLY_FARM_MESSAGE} />
    </View>
  );
}
