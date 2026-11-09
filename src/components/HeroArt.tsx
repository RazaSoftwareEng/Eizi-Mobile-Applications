import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { shadow } from '@/lib/theme';

const TILE = 96;

/** Floating 3D-style Eizi logo with an orbit ring and sparkles — decorative only. */
export function HeroArt() {
  const reduceMotion = useReducedMotion();
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    float.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, float]);

  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 + float.value * 12 }, { rotate: `${-10 + float.value * 4}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 + float.value * 6 }, { rotate: `${-18 + float.value * 6}deg` }],
  }));
  const sparkStyle = useAnimatedStyle(() => ({ opacity: 0.55 + float.value * 0.45 }));

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* soft brand glow */}
      <View style={styles.glow} />

      {/* orbit ring (behind) */}
      <Animated.View style={[styles.ring, ringStyle]} />

      {/* logo tile */}
      <Animated.View style={[styles.tile, shadow.lg, tileStyle]}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.logo} />
      </Animated.View>

      {/* sparkles */}
      <Animated.View style={[styles.sparks, sparkStyle]}>
        <View style={[styles.spark, { width: 14, transform: [{ rotate: '-60deg' }], top: 0, left: 16 }]} />
        <View style={[styles.spark, { width: 18, transform: [{ rotate: '-25deg' }], top: 14, left: 0 }]} />
        <View style={[styles.spark, { width: 12, transform: [{ rotate: '10deg' }], top: 34, left: 2 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 176,
    height: 176,
    right: -78,
    top: -6,
    borderRadius: 999,
    opacity: 0.9,
    backgroundImage: 'linear-gradient(140deg, #3FAE9C 0%, #0B6358 70%)',
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 58,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  tile: { width: TILE, height: TILE, borderRadius: TILE * 0.27, backgroundColor: '#fff' },
  logo: { width: TILE, height: TILE, borderRadius: TILE * 0.27 },
  sparks: { position: 'absolute', top: 6, left: 4, width: 40, height: 44 },
  spark: { position: 'absolute', height: 4, borderRadius: 4, backgroundColor: '#14917F' },
});
