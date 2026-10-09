import { Image } from 'react-native';

type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 64 }: BrandMarkProps) {
  return (
    <Image
      accessibilityLabel="Bloodline Book"
      source={require('../assets/brand/icon.png')}
      resizeMode="cover"
      style={{
        width: size,
        height: size,
        borderRadius: (size * 20) / 64,
      }}
    />
  );
}
