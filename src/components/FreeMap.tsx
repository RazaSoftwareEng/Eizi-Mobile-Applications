import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import type { Coords } from '@/lib/location';
import { colors, shadow } from '@/lib/theme';

// react-native-webview's class typings don't line up with React 19's JSX types yet; same component, plain props type.
type WebViewHandle = { injectJavaScript: (js: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

/** A worker shown on the map. `kind` picks the colour + icon. */
export type MapWorker = Coords & { id: string; kind: 'clean' | 'cook' | 'electric' | 'laundry' | 'dish' };

/**
 * Free map with no API key and no billing: MapLibre GL (open source) drawing OpenFreeMap tiles
 * (OpenStreetMap data, free for commercial use), inside a WebView.
 *
 * mode "pin"     – a pin is fixed in the centre; the user drags the map under it and `onMove`
 *                  reports the new centre (address picker, like ride-hailing apps).
 * mode "explore" – the user's own position is a pulsing dot that moves with the map, nearby
 *                  workers are markers, and the map can be panned / zoomed freely.
 */
export function FreeMap({
  center,
  zoom = 15,
  interactive = false,
  mode = 'pin',
  me,
  workers,
  onMove,
  onExpand,
  style,
}: {
  center: Coords;
  zoom?: number;
  interactive?: boolean;
  mode?: 'pin' | 'explore';
  me?: Coords | null;
  workers?: MapWorker[];
  onMove?: (c: Coords) => void;
  /** Shows an expand button in the top-right corner. */
  onExpand?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const web = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fromMap = useRef<Coords | null>(null); // last centre the user dragged to (don't echo it back)

  // Built once: later changes are sent to the live map instead of reloading it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(center, zoom, interactive), [interactive]);

  const run = (js: string) => web.current?.injectJavaScript(`try{${js}}catch(e){} true;`);

  useEffect(() => {
    const f = fromMap.current;
    if (!ready || (f && f.latitude === center.latitude && f.longitude === center.longitude)) return;
    run(`window.setCenter(${center.latitude}, ${center.longitude}, ${zoom});`);
  }, [center.latitude, center.longitude, zoom, ready]);

  // First time markers arrive, zoom so the user (centre) and every worker fit in view.
  const fitted = useRef(false);
  const markers = JSON.stringify({ me: mode === 'explore' && me ? me : null, workers: workers ?? [] });
  useEffect(() => {
    if (!ready) return;
    const fit = !fitted.current && mode === 'explore' && !!me && (workers?.length ?? 0) > 0;
    if (fit) fitted.current = true;
    run(`window.setMarkers(${markers}, ${fit});`);
  }, [markers, ready, mode, me, workers]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { ready?: boolean; error?: boolean; lat?: number; lng?: number };
      if (msg.ready) setReady(true);
      if (msg.error) setFailed(true);
      if (typeof msg.lat === 'number' && typeof msg.lng === 'number') {
        const c = { latitude: msg.lat, longitude: msg.lng };
        fromMap.current = c;
        onMove?.(c);
      }
    } catch {
      // ignore
    }
  }

  return (
    <View style={[styles.box, style]} pointerEvents={interactive || onExpand ? 'box-none' : 'none'}>
      <View style={StyleSheet.absoluteFill} pointerEvents={interactive ? 'auto' : 'none'}>
        <WebView
          ref={web}
          source={{ html, baseUrl: 'https://eizi.app/' }}
          originWhitelist={['*']}
          onMessage={onMessage}
          style={styles.web}
          scrollEnabled={false}
          nestedScrollEnabled
          overScrollMode="never"
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          onError={() => setFailed(true)}
          androidLayerType="hardware"
        />
      </View>

      {mode === 'pin' ? (
        <View pointerEvents="none" style={styles.pinWrap}>
          <View style={styles.pulse} />
          <Ionicons name="location" size={42} color={colors.brandDark} style={styles.pin} />
        </View>
      ) : null}

      {/* Map buttons */}
      {ready && (onExpand || (mode === 'explore' && me && interactive)) ? (
        <View style={styles.controls} pointerEvents="box-none">
          {onExpand ? <MapButton icon="expand" label="Open full map" onPress={onExpand} /> : null}
          {mode === 'explore' && me && interactive ? (
            <MapButton icon="locate" label="Back to my location" onPress={() => run(`window.setCenter(${me.latitude}, ${me.longitude}, 15.5);`)} />
          ) : null}
        </View>
      ) : null}

      {!ready && !failed ? (
        <View pointerEvents="none" style={styles.cover}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}
      {failed ? (
        <View pointerEvents="none" style={styles.cover}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.subtle} />
        </View>
      ) : null}
    </View>
  );
}

function MapButton({ icon, label, onPress }: { icon: 'expand' | 'locate'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="h-10 w-10 items-center justify-center rounded-full bg-white active:bg-slate-100"
      style={shadow.md}
    >
      <Ionicons name={icon} size={19} color={colors.brandDark} />
    </Pressable>
  );
}

// Small inline SVG icons for worker markers (no emoji, no external sprites).
const ICONS: Record<MapWorker['kind'], [string, string]> = {
  clean: ['#0E7A6B', '<path d="M14 3l-1 7h3l-1-7zM9 11h10l1 3H8zM8 15h12l-1 6H9z" fill="#fff"/>'],
  cook: ['#B45309', '<path d="M9 9a3 3 0 015-2.2A3 3 0 0119 9a2.5 2.5 0 01-1 2v3H10v-3a2.5 2.5 0 01-1-2zm1 6h8v2H10z" fill="#fff"/>'],
  electric: ['#4338CA', '<path d="M15 3l-6 10h4l-2 8 7-11h-4z" fill="#fff"/>'],
  laundry: ['#BE185D', '<rect x="8" y="5" width="12" height="16" rx="2" fill="none" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="3.2" fill="none" stroke="#fff" stroke-width="2"/>'],
  dish: ['#0891B2', '<circle cx="14" cy="14" r="6" fill="none" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="2.5" fill="#fff"/>'],
};

function mapHtml(c: Coords, zoom: number, interactive: boolean) {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%;background:#E9EFEC}
.maplibregl-ctrl-attrib{font-size:9px;opacity:.8}.maplibregl-ctrl-logo{display:none!important}
.me{width:22px;height:22px;border-radius:50%;background:#2563EB;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);position:relative}
.me:before{content:'';position:absolute;left:50%;top:50%;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;background:rgba(37,99,235,.22);animation:p 2s ease-out infinite}
@keyframes p{0%{transform:scale(.3);opacity:1}100%{transform:scale(1);opacity:0}}
.w{width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 8px rgba(15,23,42,.28);display:flex;align-items:center;justify-content:center;animation:in .4s ease-out}
@keyframes in{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
(function(){
  var post=function(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o));};
  window.setCenter=function(){};window.setMarkers=function(){};
  if(!window.maplibregl){post({error:true});return;}
  var ICONS=${JSON.stringify(ICONS)};
  try{
    var map=new maplibregl.Map({container:'m',style:'https://tiles.openfreemap.org/styles/liberty',
      center:[${c.longitude},${c.latitude}],zoom:${zoom},interactive:${interactive ? 'true' : 'false'},
      attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false});
    map.touchZoomRotate&&map.touchZoomRotate.disableRotation();
    map.on('styleimagemissing',function(e){map.addImage(e.id,{width:1,height:1,data:new Uint8Array(4)});});
    map.on('load',function(){
      document.querySelectorAll('.maplibregl-ctrl-attrib').forEach(function(el){el.classList.remove('maplibregl-compact-show');});
      post({ready:true});
    });
    map.on('moveend',function(e){if(!e.originalEvent)return;var p=map.getCenter();post({lat:p.lat,lng:p.lng});});
    window.setCenter=function(lat,lng,z){map.easeTo({center:[lng,lat],zoom:z||map.getZoom(),duration:700});};
    var live=[];
    window.setMarkers=function(d,fit){
      live.forEach(function(m){m.remove();});live=[];
      (d.workers||[]).forEach(function(w){
        var ic=ICONS[w.kind]||ICONS.clean,el=document.createElement('div');
        el.className='w';el.style.background=ic[0];
        el.innerHTML='<svg width="18" height="18" viewBox="4 2 20 20">'+ic[1]+'</svg>';
        live.push(new maplibregl.Marker({element:el}).setLngLat([w.longitude,w.latitude]).addTo(map));
      });
      if(d.me){var me=document.createElement('div');me.className='me';
        live.push(new maplibregl.Marker({element:me}).setLngLat([d.me.longitude,d.me.latitude]).addTo(map));}
      if(fit&&d.me&&d.workers&&d.workers.length){
        // keep the user exactly in the middle: use the farthest worker on each axis, mirrored
        var dl=0,dg=0;d.workers.forEach(function(w){dl=Math.max(dl,Math.abs(w.latitude-d.me.latitude));dg=Math.max(dg,Math.abs(w.longitude-d.me.longitude));});
        map.fitBounds([[d.me.longitude-dg,d.me.latitude-dl],[d.me.longitude+dg,d.me.latitude+dl]],{padding:36,maxZoom:15.5,duration:0});
      }
    };
  }catch(e){post({error:true});}
})();
</script></body></html>`;
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: '#E9EFEC' },
  web: { flex: 1, backgroundColor: 'transparent' },
  pinWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(20,145,127,0.18)' },
  pin: { marginTop: -38 },
  controls: { position: 'absolute', top: 10, right: 10, gap: 8 },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EFEC' },
});
