import type { ImageSourcePropType } from 'react-native';

export const PILOT_GUIDE_IMAGES: Record<
  | 'signUp'
  | 'createFarm'
  | 'addGoat'
  | 'herdList'
  | 'familyTree'
  | 'recordWeight',
  ImageSourcePropType
> = {
  signUp: require('@/assets/pilot-guide/sign-up.webp'),
  createFarm: require('@/assets/pilot-guide/create-farm.webp'),
  addGoat: require('@/assets/pilot-guide/add-goat.webp'),
  herdList: require('@/assets/pilot-guide/herd-list.webp'),
  familyTree: require('@/assets/pilot-guide/family-tree.webp'),
  recordWeight: require('@/assets/pilot-guide/record-weight.webp'),
};
