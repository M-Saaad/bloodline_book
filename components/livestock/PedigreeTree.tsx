import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import {
  pedigreePositionLabel,
  type Pedigree,
  type PedigreeBranch,
} from '@/lib/domain/pedigree';

/** Width taken by the lines between one column and the next. */
export const PEDIGREE_CONNECTOR_WIDTH = 24;

const LINE_COLOR = '#d9cec6'; // gray-300
const LINE = 2;
const STUB_WIDTH = 10;
const BRANCH_WIDTH = PEDIGREE_CONNECTOR_WIDTH - STUB_WIDTH;

export interface PedigreeSubject {
  name: string | null;
  tagNumber: string | null;
  registrationNumber: string | null;
}

interface PedigreeTreeProps {
  pedigree: Pedigree;
  boxWidth: number;
  /** Shows the goat itself as the first column (full pedigree screen). */
  subject?: PedigreeSubject;
}

/**
 * Sideways pedigree, sire above dam, like a registry paper.
 * Each box is centred against the two boxes behind it.
 */
export function PedigreeTree({ pedigree, boxWidth, subject }: PedigreeTreeProps) {
  if (subject) {
    return (
      <View className="flex-row items-center">
        <SubjectBox subject={subject} width={boxWidth} />
        <Stub />
        <View>
          <ChildSlot position="top">
            <BranchView branch={pedigree.sire} boxWidth={boxWidth} />
          </ChildSlot>
          <ChildSlot position="bottom">
            <BranchView branch={pedigree.dam} boxWidth={boxWidth} />
          </ChildSlot>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <BranchView branch={pedigree.sire} boxWidth={boxWidth} />
      <BranchView branch={pedigree.dam} boxWidth={boxWidth} />
    </View>
  );
}

function BranchView({ branch, boxWidth }: { branch: PedigreeBranch; boxWidth: number }) {
  if (!branch.sire || !branch.dam) {
    return <PedigreeBox branch={branch} width={boxWidth} />;
  }
  return (
    <View className="flex-row items-center">
      <PedigreeBox branch={branch} width={boxWidth} />
      <Stub />
      <View>
        <ChildSlot position="top">
          <BranchView branch={branch.sire} boxWidth={boxWidth} />
        </ChildSlot>
        <ChildSlot position="bottom">
          <BranchView branch={branch.dam} boxWidth={boxWidth} />
        </ChildSlot>
      </View>
    </View>
  );
}

/** Short horizontal line from a box towards its parents. */
function Stub() {
  return <View style={{ width: STUB_WIDTH, height: LINE, backgroundColor: LINE_COLOR }} />;
}

/**
 * Wraps one parent branch and draws its half of the bracket: a horizontal
 * line at its middle, and the vertical line joining it to its pair.
 */
function ChildSlot({
  position,
  children,
}: {
  position: 'top' | 'bottom';
  children: ReactNode;
}) {
  return (
    <View className="flex-row">
      <View style={{ width: BRANCH_WIDTH }}>
        <View
          style={{
            flex: 1,
            borderLeftWidth: position === 'bottom' ? LINE : 0,
            borderColor: LINE_COLOR,
          }}
        />
        <View
          style={{
            flex: 1,
            borderTopWidth: LINE,
            borderLeftWidth: position === 'top' ? LINE : 0,
            borderColor: LINE_COLOR,
          }}
        />
      </View>
      <View className="py-1">{children}</View>
    </View>
  );
}

function SubjectBox({ subject, width }: { subject: PedigreeSubject; width: number }) {
  const detail = detailLine(subject.tagNumber, subject.registrationNumber);
  return (
    <View
      style={{ width }}
      className="min-h-[68px] rounded-2xl bg-bloodline-900 px-3 py-2 justify-center">
      <Text className="text-[16px] font-extrabold text-white" numberOfLines={2}>
        {subject.name ?? (subject.tagNumber ? `#${subject.tagNumber}` : 'This goat')}
      </Text>
      {detail ? (
        <Text className="text-[13px] text-white/85 mt-0.5" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function PedigreeBox({ branch, width }: { branch: PedigreeBranch; width: number }) {
  const role = branch.role === 'sire' ? 'Sire' : 'Dam';
  const position = pedigreePositionLabel(branch.path);
  const { node } = branch;

  if (node.kind === 'unknown') {
    return (
      <View
        style={{ width }}
        accessibilityLabel={`${position}: unknown`}
        className="min-h-[60px] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-2 justify-center">
        <RoleLabel role={role} muted />
        <Text className="text-[15px] text-gray-500">Unknown</Text>
      </View>
    );
  }

  if (node.kind === 'outside') {
    return (
      <View
        style={{ width }}
        accessibilityLabel={`${position}: ${node.name}, not in your herd`}
        className="min-h-[60px] rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 justify-center">
        <RoleLabel role={role} />
        <Text className="text-[15px] font-bold text-ink" numberOfLines={2}>
          {node.name}
        </Text>
        <Text className="text-[13px] text-gray-500" numberOfLines={1}>
          Not in your herd
        </Text>
      </View>
    );
  }

  const name = node.name ?? (node.tagNumber ? `#${node.tagNumber}` : 'Unnamed goat');
  const detail = detailLine(node.name ? node.tagNumber : null, node.registrationNumber);
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/livestock/${node.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${position}: ${name}. Open goat`}
      style={{ width }}
      className="min-h-[60px] rounded-2xl border-2 border-bloodline-200 bg-white px-3 py-2 justify-center active:bg-bloodline-50">
      <RoleLabel role={role} />
      <Text className="text-[15px] font-bold text-bloodline-700" numberOfLines={2}>
        {name}
      </Text>
      {detail ? (
        <Text className="text-[13px] text-gray-500" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

function RoleLabel({ role, muted = false }: { role: string; muted?: boolean }) {
  return (
    <Text
      className={`text-[11px] font-extrabold uppercase tracking-wide ${
        muted ? 'text-gray-400' : 'text-gray-500'
      }`}>
      {role}
    </Text>
  );
}

function detailLine(tag: string | null, registration: string | null): string | null {
  const parts = [tag ? `#${tag}` : null, registration ? `Reg ${registration}` : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}
