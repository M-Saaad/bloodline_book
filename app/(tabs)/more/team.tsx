import { useQuery } from '@powersync/react';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { LoadingState } from '@/components/ui/LoadingState';
import { TEAM_INVITES_ENABLED } from '@/lib/config/features';
import { mapFarmInvite, mapFarmMember } from '@/lib/db/mappers';
import { createFarmInvite, revokeFarmInvite } from '@/lib/db/team';
import type { FarmInvite } from '@/lib/types/team';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

export default function TeamScreen() {
  const { activeFarm } = useFarm();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FarmInvite['role']>('hand');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { data: memberRows, isLoading: membersLoading } = useQuery(
    activeFarm
      ? 'SELECT * FROM farm_members WHERE farm_id = ? ORDER BY created_at'
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: inviteRows, isLoading: invitesLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM farm_invites
         WHERE farm_id = ?
         ORDER BY created_at DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const members = (memberRows ?? []).map((row) =>
    mapFarmMember(row as Record<string, unknown>),
  );
  const invites = (inviteRows ?? []).map((row) =>
    mapFarmInvite(row as Record<string, unknown>),
  );

  if (!TEAM_INVITES_ENABLED) {
    return <Redirect href="/(tabs)/more" />;
  }

  async function handleInvite() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await createFarmInvite(activeFarm.id, { email: email.trim(), role });
      setEmail('');
      setSuccessMessage(
        'Invite recorded. They will be added when they sign up with this email.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create invite.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    setErrorMessage('');
    try {
      await revokeFarmInvite(inviteId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not revoke invite.',
      );
    }
  }

  if (!activeFarm) {
    return null;
  }

  if (membersLoading || invitesLoading) {
    return <LoadingState message="Loading team…" />;
  }

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pt-2 pb-10 gap-4">
      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">Members</Text>
        {members.length === 0 ? (
          <Text className="text-base text-gray-500">No members found.</Text>
        ) : (
          members.map((member) => (
            <View
              key={`${member.farmId}-${member.userId}`}
              className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <Text className="text-[15px] text-ink font-mono">
                {member.userId.slice(0, 8)}…
              </Text>
              <Badge label={member.role} />
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">
          Pending invites
        </Text>
        {invites.filter((i) => i.status === 'pending').length === 0 ? (
          <Text className="text-base text-gray-500 mb-3">No pending invites.</Text>
        ) : (
          invites
            .filter((invite) => invite.status === 'pending')
            .map((invite) => (
              <View
                key={invite.id}
                className="flex-row justify-between items-center py-2 border-b border-gray-100">
                <View>
                  <Text className="text-[17px] font-bold text-ink">{invite.email}</Text>
                  <Text className="text-[15px] text-gray-500 capitalize">
                    {invite.role}
                  </Text>
                </View>
                <Button
                  title="Revoke"
                  variant="outline"
                  onPress={() => handleRevoke(invite.id)}
                  className="px-4"
                />
              </View>
            ))
        )}
      </Card>

      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">
          Invite teammate
        </Text>
        <FormMessage message={errorMessage} tone="error" />
        <FormMessage message={successMessage} tone="success" />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="hand@farm.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View className="mb-4">
          <FieldLabel>Role</FieldLabel>
          <Segmented
            options={[
              { value: 'manager', label: 'Manager' },
              { value: 'hand', label: 'Hand' },
            ]}
            value={role}
            onChange={setRole}
          />
        </View>
        <Button
          title={loading ? 'Sending…' : 'Send invite'}
          onPress={handleInvite}
          disabled={loading}
        />
      </Card>
    </ScrollView>
  );
}
