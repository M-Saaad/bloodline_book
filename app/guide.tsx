import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { GuideStep } from '@/components/pilot/GuideStep';
import { PilotPublicLayout } from '@/components/pilot/PilotPublicLayout';
import { PilotSupportFooter } from '@/components/pilot/PilotSupportFooter';
import { PILOT_GUIDE_IMAGES } from '@/lib/pilot/guide-images';
import { Text } from '@/components/ui/Text';

export default function GuideScreen() {
  return (
    <PilotPublicLayout
      title="Your first 10 goats"
      intro="Work through these steps once. After that, adding goats and weights is quick.">
      <GuideStep
        step={1}
        title="Create your account"
        body="Tap Create one on the sign-in screen. Use an email you can check from your phone. Pick a password you will remember."
        image={PILOT_GUIDE_IMAGES.signUp}
        imageAlt="Create account screen"
      />
      <GuideStep
        step={2}
        title="Create your farm"
        body="Give your operation a name, pick dairy or meat (or both), and choose pounds or kilograms for weights."
        image={PILOT_GUIDE_IMAGES.createFarm}
        imageAlt="Create farm screen"
      />
      <GuideStep
        step={3}
        title="Add your first goat"
        body="You need a name or a tag number — at least one. Sex helps sort your list. Breed, birthday, and parents are optional; add them when you know them."
        image={PILOT_GUIDE_IMAGES.addGoat}
        imageAlt="Add goat form"
      />
      <GuideStep
        step={4}
        title="Add nine more"
        body="Tap Add goat from the herd list until you have ten on the list. A tag number alone is enough if you do not use names."
        image={PILOT_GUIDE_IMAGES.herdList}
        imageAlt="Herd list with several goats"
      />
      <GuideStep
        step={5}
        title="See the family tree"
        body="Tap a goat that has a dam or sire filled in. Scroll to Family tree to see parents and kids on one screen."
        image={PILOT_GUIDE_IMAGES.familyTree}
        imageAlt="Family tree on a goat profile"
      />
      <GuideStep
        step={6}
        title="Record a weight"
        body="From Livestock, open Weigh. Pick the goat, enter the weight, and save. You can weigh more than one goat in the same session."
        image={PILOT_GUIDE_IMAGES.recordWeight}
        imageAlt="Weigh screen"
      />

      <PilotSupportFooter
        lead="Stuck on a step? Send us a screenshot and we will help."
      />

      <View className="mt-6 flex-row flex-wrap gap-x-2 justify-center items-center">
        <Link href="/install" asChild>
          <Pressable className="min-h-[44px] justify-center">
            <Text className="text-[17px] font-extrabold text-bloodline-600">
              ← Install on your phone
            </Text>
          </Pressable>
        </Link>
      </View>
      <View className="mt-4 flex-row flex-wrap justify-center">
        <Link href="/data" asChild>
          <Pressable className="min-h-[44px] justify-center">
            <Text className="text-[17px] font-extrabold text-bloodline-600">
              Your data and privacy
            </Text>
          </Pressable>
        </Link>
      </View>
    </PilotPublicLayout>
  );
}
