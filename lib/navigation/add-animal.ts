import { router, type Href } from 'expo-router';

import { ADD_ANIMAL_SESSION_PARAM } from '@/lib/domain/add-animal-form';

export function createAddAnimalSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type AddAnimalRouteParams = {
  session?: string;
  duplicateFrom?: string;
  prefill?: string;
};

export function buildAddAnimalHref(
  options: AddAnimalRouteParams & { session?: string } = {},
): Href {
  const session = options.session ?? createAddAnimalSessionId();
  const search = new URLSearchParams({ [ADD_ANIMAL_SESSION_PARAM]: session });
  if (options.duplicateFrom) {
    search.set('duplicateFrom', options.duplicateFrom);
  }
  if (options.prefill) {
    search.set('prefill', options.prefill);
  }
  return `/(tabs)/livestock/add?${search.toString()}` as Href;
}

/** Start a new Add goat flow (fresh session id in the URL). */
export function pushNewAddAnimalSession(
  options: Omit<AddAnimalRouteParams, 'session'> = {},
): void {
  router.push(buildAddAnimalHref(options));
}
