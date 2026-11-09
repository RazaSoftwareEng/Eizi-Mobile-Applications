import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';

const LOGO = 120; // must match `imageWidth` of the expo-splash-screen plugin in app.json
const MIN_SHOW_MS = 1700; // long enough to enjoy the intro, short enough not to annoy
const EXIT_MS = 380;

/**
 * Animated intro that takes over from the native splash screen.
 * Starts pixel-identical to the native splash (same colour, same logo, same size, centred),
 * so the hand-off is invisible, then animates and fades out once the app is `ready`.
 */
export function AnimatedSplash({ ready }: { ready: boolean }) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const nativeHidden = useRef(false);

  const logoScale = useSharedValue(1);
  const logoY = useSharedValue(0);
  const ring = useSharedValue(0);
  const word = useSharedValue(0);
  const tagline = useSharedValue(0);
  const progress = useSharedValue(0);
  const overlay = useSharedValue(1);

  function hideNative() {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hide();
  }

  // Intro
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), reduceMotion ? 500 : MIN_SHOW_MS);
    const fallback = setTimeout(hideNative, 1500); // never leave the native splash stuck

    if (reduceMotion) {
      word.set(withTiming(1, { duration: 250 }));
      tagline.set(withTiming(1, { duration: 250 }));
      logoY.set(-36);
    } else {
      const ease = Easing.out(Easing.cubic);
      logoScale.set(withSequence(
        withTiming(1.1, { duration: 260, easing: ease }),
        withSpring(1, { damping: 9, stiffness: 140 }),
      ));
      ring.set(withDelay(120, withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), 2, false)));
      logoY.set(withDelay(300, withSpring(-36, { damping: 14, stiffness: 120 })));
      word.set(withDelay(480, withTiming(1, { duration: 420, easing: ease })));
      tagline.set(withDelay(680, withTiming(1, { duration: 420, easing: ease })));
      progress.set(withDelay(700, withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.cubic) })));
    }
    return () => {
      clearTimeout(t);
      clearTimeout(fallback);
    };
    // Shared values are stable refs; the intro runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Exit once the app is ready and the intro has had its moment
  useEffect(() => {
    if (!ready || !minTimePassed) return;
    progress.set(withTiming(1, { duration: 200 }));
    overlay.set(withDelay(160, withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) })));
    if (!reduceMotion) logoScale.set(withDelay(160, withTiming(1.25, { duration: EXIT_MS, easing: Easing.in(Easing.quad) })));
    const t = setTimeout(() => setVisible(false), 160 + EXIT_MS + 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minTimePassed, reduceMotion]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoY.value }, { scale: logoScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.35,
    transform: [{ translateY: logoY.value }, { scale: 1 + ring.value * 1.2 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: 52 + (1 - word.value) * 14 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: 96 + (1 - tagline.value) * 10 }],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%`, opacity: progress.value > 0 ? 1 : 0 }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}
      onLayout={hideNative}
      pointerEvents={ready && minTimePassed ? 'none' : 'auto'}
      accessibilityLabel="Eizi is loading"
      accessible
    >
      <StatusBar style="light" />
      {/* soft background shapes */}
      <View style={[styles.blob, { top: -120, right: -100, width: 320, height: 320 }]} />
      <View style={[styles.blob, { bottom: -140, left: -120, width: 300, height: 300, backgroundColor: 'rgba(20,145,127,0.25)' }]} />

      <View style={styles.center}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={logoStyle}>
          <Image source={require('../../assets/splash-icon.png')} style={styles.logo} />
        </Animated.View>

        <Animated.Text style={[styles.word, wordStyle]}>Eizi</Animated.Text>
        <Animated.View style={[styles.taglineWrap, taglineStyle]}>
          <Text style={styles.tagline}>Ghar ki har service, ek tap door</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, barStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.brandDeep, zIndex: 1000, elevation: 1000 },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: LOGO, height: LOGO, borderRadius: LOGO * 0.27, backgroundColor: colors.white },
  logo: { width: LOGO, height: LOGO },
  word: { position: 'absolute', color: colors.white, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  taglineWrap: { position: 'absolute' },
  tagline: { color: '#A9E0D6', fontSize: 15, fontWeight: '500' },
  footer: { position: 'absolute', bottom: 72, left: 0, right: 0, alignItems: 'center' },
  track: { width: 120, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  bar: { height: 4, borderRadius: 4, backgroundColor: colors.white },
});
