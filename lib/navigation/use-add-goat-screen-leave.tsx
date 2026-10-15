import { useFocusEffect, useNavigation } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { BackHandler, Platform, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { usePreventRemove } from '@/lib/navigation/use-prevent-remove';

type Options = {
  hasUnsavedChanges: boolean;
  allowLeaveRef: MutableRefObject<boolean>;
  confirmDiscardIfNeeded: () => Promise<boolean>;
};

/**
 * Stack back, OS back, and browser refresh hooks for Add goat.
 * Tab / quick-add guards use requestLeaveAddGoatScreen separately.
 */
export function useAddGoatScreenLeave({
  hasUnsavedChanges,
  allowLeaveRef,
  confirmDiscardIfNeeded,
}: Options) {
  const navigation = useNavigation();
  const [leaveConfirmed, setLeaveConfirmed] = useState(false);
  const pendingHeaderBackRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setLeaveConfirmed(false);
      pendingHeaderBackRef.current = false;
    }, []),
  );

  const shouldBlockLeave =
    hasUnsavedChanges && !leaveConfirmed && !allowLeaveRef.current;

  const leaveViaNavigation = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const requestHeaderOrHardwareBack = useCallback(() => {
    void (async () => {
      if (shouldBlockLeave) {
        const discard = await confirmDiscardIfNeeded();
        if (!discard) {
          return;
        }
        setLeaveConfirmed(true);
        pendingHeaderBackRef.current = true;
        return;
      }
      leaveViaNavigation();
    })();
  }, [
    confirmDiscardIfNeeded,
    leaveViaNavigation,
    shouldBlockLeave,
  ]);

  useEffect(() => {
    if (!leaveConfirmed || !pendingHeaderBackRef.current) {
      return;
    }
    pendingHeaderBackRef.current = false;
    leaveViaNavigation();
  }, [leaveConfirmed, leaveViaNavigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={requestHeaderOrHardwareBack}
          className="min-h-[44px] min-w-[44px] justify-center px-2">
          <Text className="text-lg font-semibold text-bloodline-600">Back</Text>
        </Pressable>
      ),
    });
  }, [navigation, requestHeaderOrHardwareBack]);

  usePreventRemove(shouldBlockLeave, ({ data }) => {
    void (async () => {
      const discard = await confirmDiscardIfNeeded();
      if (!discard) {
        return;
      }
      setLeaveConfirmed(true);
      navigation.dispatch(data.action);
    })();
  });

  useEffect(() => {
    const onHardwareBack = () => {
      if (!shouldBlockLeave) {
        return false;
      }
      requestHeaderOrHardwareBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [requestHeaderOrHardwareBack, shouldBlockLeave]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || allowLeaveRef.current || leaveConfirmed) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [allowLeaveRef, hasUnsavedChanges, leaveConfirmed]);
}
