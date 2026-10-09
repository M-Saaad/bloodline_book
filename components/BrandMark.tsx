import { Image } from 'react-native';

type BrandMarkProps = {
  /** Height in px. Width follows the logo's proportions (603 x 799). */
  size?: number;
};

const ASPECT = 603 / 799;

/**
 * The Bloodline Book logo: the red book with the goat. The image is cropped
 * to the book on a transparent background, so it sits cleanly on any screen
 * color and no longer shows a cream square around it.
 */
export function BrandMark({ size = 48 }: BrandMarkProps) {
  return (
    <Image
      accessibilityLabel="Bloodline Book"
      source={require('../assets/brand/mark.png')}
      resizeMode="contain"
      style={{ height: size, width: Math.round(size * ASPECT) }}
    />
  );
}
