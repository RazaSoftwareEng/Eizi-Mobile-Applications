import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FreeMap, type MapWorker } from '@/components/FreeMap';
import { Button } from '@/components/ui';
import { DEFAULT_CENTER, type PickedLocation } from '@/lib/location';
import { KIND_COLOR, KIND_LABEL } from '@/lib/nearbyWorkers';
import { colors, shadow } from '@/lib/theme';

/** Full-screen map: the user in the middle, workers around them, free to pan and zoom. */
export function NearbyMapModal({ visible, onClose, here, workers }: {
  visible: boolean;
  onClose: () => void;
  here: PickedLocation | null;
  workers: MapWorker[];
}) {
  const insets = useSafeAreaInsets();
  const counts = workers.reduce<Partial<Record<MapWorker['kind'], number>>>((acc, w) => ({ ...acc, [w.kind]: (acc[w.kind] ?? 0) + 1 }), {});

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-white">
        {visible ? (
          <FreeMap
            center={here ?? DEFAULT_CENTER}
            zoom={here ? 14.5 : 11}
            interactive
            mode="explore"
            me={here}
            workers={workers}
            style={{ flex: 1 }}
          />
        ) : null}

        {/* Top bar */}
        <View className="absolute left-0 right-0 flex-row items-center gap-3 px-4" style={{ top: insets.top + 10 }} pointerEvents="box-none">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close map"
            className="h-11 w-11 items-center justify-center rounded-full bg-white active:bg-slate-100"
            style={shadow.md}
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1 rounded-full bg-white px-4 py-2.5" style={shadow.md}>
            <Text className="text-[13px] font-bold text-ink" numberOfLines={1}>
              {workers.length} workers near you
            </Text>
            <Text className="text-[11px] text-slate-500" numberOfLines={1}>
              {here?.address || 'Your area'}
            </Text>
          </View>
        </View>

        {/* Bottom card */}
        <View className="rounded-t-3xl bg-white px-5 pt-4" style={[shadow.top, { paddingBottom: insets.bottom + 14 }]}>
          <Text className="text-base font-bold text-ink">Who&apos;s around you</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(Object.keys(counts) as MapWorker['kind'][]).map((k) => (
              <View key={k} className="flex-row items-center gap-1.5 rounded-full bg-surface px-3 py-1.5">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: KIND_COLOR[k] }} />
                <Text className="text-[12px] font-semibold text-slate-700">
                  {KIND_LABEL[k]} · {counts[k]}
                </Text>
              </View>
            ))}
          </View>
          <Text className="mt-3 text-xs leading-5 text-slate-500">
            Drag and zoom the map to explore. When you request a service, it goes to workers like these near you.
          </Text>
          <Button className="mt-4" title="Request a service" icon="arrow-forward" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
