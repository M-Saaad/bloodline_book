import { TextSizeOptionsList, TextSizePreviewSample } from '@/components/TextSizeOptionsList';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTextSizeStore } from '@/lib/store/text-size';

/**
 * "Text size" choice for the whole app. Saved on this phone only: it applies
 * at once, works offline, and is not part of the farm's synced settings.
 */
export function TextSizeSetting() {
  const size = useTextSizeStore((state) => state.size);
  const setSize = useTextSizeStore((state) => state.setSize);

  return (
    <Card className="mb-5">
      <Text className="text-[19px] font-extrabold text-ink">Text size</Text>
      <Text className="text-base text-gray-500 mt-1 mb-3">
        Makes all text in the app bigger or smaller. This only changes this
        phone. You can change this anytime here (including after your first
        setup).
      </Text>
      <TextSizeOptionsList selected={size} onSelect={setSize} />
      <TextSizePreviewSample />
    </Card>
  );
}
