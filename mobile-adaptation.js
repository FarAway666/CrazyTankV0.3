import { detectMobilePlatform } from './mobile-runtime.js';

const MOBILE_MAX_PIXEL_RATIO = 1;
const MOBILE_PIXEL_RATIO = 0.75;
const MINIMAP_INTERVAL_MS_MOBILE = 80;
const MOBILE_SFX_CHANNELS = Object.freeze({
    mgFire: 1,
    sniperFire: 2,
    shotgunFire: 2,
    freezeFire: 2,
    toxicFire: 2,
    blindFire: 2,
    cannonCooldown: 2,
    hit: 3,
    nearMiss: 3,
    satelliteExplosion: 2,
    pickupSatellite: 2,
    pickupHealth: 2,
    deathExplosion: 2
});

export function createMobileAdaptationContext() {
    const { isTouchDevice, isMobilePerfMode } = detectMobilePlatform();
    const audioEnabled = !isMobilePerfMode;

    function getRenderPixelRatio() {
        const dpr = window.devicePixelRatio || 1;
        if (isTouchDevice) return Math.min(dpr, MOBILE_MAX_PIXEL_RATIO) * MOBILE_PIXEL_RATIO;
        return isMobilePerfMode ? Math.min(dpr, MOBILE_MAX_PIXEL_RATIO) : dpr;
    }

    function shouldSkipMinimapDraw(nowMs, lastDrawAt) {
        return isMobilePerfMode && (nowMs - lastDrawAt < MINIMAP_INTERVAL_MS_MOBILE);
    }

    const FIRE_SFX_KEYS = new Set(['mgFire', 'shotgunFire', 'sniperFire', 'freezeFire', 'toxicFire', 'blindFire', 'cannonCooldown']);
    function shouldMuteFireSfx(key) {
        return isTouchDevice && FIRE_SFX_KEYS.has(key);
    }

    return {
        isTouchDevice,
        isMobilePerfMode,
        audioEnabled,
        shouldMuteFireSfx,
        getRenderPixelRatio,
        shouldSkipMinimapDraw
    };
}

export function getAdaptiveAudioChannelCount(key, isMobilePerfMode) {
    if (!isMobilePerfMode) return 1;
    return MOBILE_SFX_CHANNELS[key] ?? 2;
}

export function getAdaptiveViewportSize() {
    const vv = window.visualViewport;
    const width = Math.max(1, Math.round(vv && vv.width ? vv.width : window.innerWidth));
    const height = Math.max(1, Math.round(vv && vv.height ? vv.height : window.innerHeight));
    return { width, height };
}
