import { View } from 'react-native';

import { Banner } from '@/components/ui/Banner';

export function ReadOnlyFarmBanner() {
  return (
    <View className="mb-4">
      <Banner
        tone="blue"
        title="View only"
        message="Your role on this farm can view records but not add or edit them."
      />
    </View>
  );
}
