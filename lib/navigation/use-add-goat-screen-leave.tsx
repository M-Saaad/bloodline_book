import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, type MutableRefObject } from 'react';
import { BackHandler, Platform, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { usePreventRemove } from '@/lib/navigation/use-prevent-remove';

type Options = {
  hasUnsavedChanges: boolean;
  allowLeaveRef: MutableRefObject<boolean>;
  confirmDiscardIfNeeded: () => Promise<boolean>;
};

/**
 * Stack back, OS back, and browser back/refresh hooks for Add goat.
 * Tab / quick-add guards use requestLeaveAddGoatScreen separately.
 */
export function useAddGoatScreenLeave({
  hasUnsavedChanges,
  allowLeaveRef,
  confirmDiscardIfNeeded,
}: Options) {
  const navigation = useNavigation();

  const shouldBlockLeave = hasUnsavedChanges && !allowLeaveRef.current;

  const leaveViaNavigation = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            leaveViaNavigation();
          }}
          className="min-h-[44px] min-w-[44px] justify-center px-2">
          <Text className="text-lg font-semibold text-bloodline-600">Back</Text>
        </Pressable>
      ),
    });
  }, [navigation, leaveViaNavigation]);

  usePreventRemove(shouldBlockLeave, ({ data }) => {
    void (async () => {
      const discard = await confirmDiscardIfNeeded();
      if (!discard) {
        return;
      }
      navigation.dispatch(data.action);
    })();
  });

  useEffect(() => {
    const onHardwareBack = () => {
      if (!hasUnsavedChanges || allowLeaveRef.current) {
        return false;
      }
      leaveViaNavigation();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [allowLeaveRef, hasUnsavedChanges, leaveViaNavigation]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || allowLeaveRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [allowLeaveRef, hasUnsavedChanges]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    if (!hasUnsavedChanges || allowLeaveRef.current) {
      return;
    }

    const trapUrl = window.location.href;
    window.history.pushState({ addGoatDraftTrap: true }, '', trapUrl);

    const onPopState = () => {
      if (allowLeaveRef.current || !hasUnsavedChanges) {
        return;
      }
      window.history.pushState({ addGoatDraftTrap: true }, '', trapUrl);
      void (async () => {
        const discard = await confirmDiscardIfNeeded();
        if (!discard) {
          return;
        }
        allowLeaveRef.current = true;
        window.removeEventListener('popstate', onPopState);
        leaveViaNavigation();
      })();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [allowLeaveRef, confirmDiscardIfNeeded, hasUnsavedChanges, leaveViaNavigation]);
}
