import {
  parseFarmMemberRole,
  type FarmMemberRole,
} from '@/lib/domain/farm-role-access';
import { supabase } from '@/lib/supabase/client';

export async function getFarmMemberRoleFromSupabase(
  farmId: string,
  userId: string,
): Promise<FarmMemberRole | null> {
  const { data, error } = await supabase
    .from('farm_members')
    .select('role')
    .eq('farm_id', farmId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getFarmMemberRoleFromSupabase:', error.message);
    return null;
  }
  return parseFarmMemberRole(data?.role);
}