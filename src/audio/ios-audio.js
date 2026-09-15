/**
 * iOS Audio Session Module
 *
 * Purpose: Make Web Audio actually audible on iPhone/iPad.
 *
 * Dependencies:
 * - Logger
 *
 * Exports:
 * - iOSAudio object - audio session configuration and unlock helpers
 *
 * Why this module exists:
 * On iOS the synthesiser can be running perfectly — context 'running',
 * oscillators scheduled, FFT animating — and still produce no sound. There are
 * three separate iOS-only reasons for that, and this module handles all three:
 *
 * 1. The ringer/silent switch.
 *    Safari puts a bare AudioContext in the 'ambient' audio session category,
 *    which is silenced by the hardware mute switch. Since the page never plays
 *    a media element, iOS assumes the audio is incidental and mutes it. Most
 *    users never connect "my phone is on silent" with "this website is broken".
 *    Fixed by requesting the 'playback' category, which ignores the switch.
 *
 * 2. The user-gesture requirement.
 *    iOS only lets an AudioContext start inside a real user gesture, and it is
 *    stricter than other browsers: the create/resume call must happen in the
 *    same task as the gesture. Awaiting anything first (a helper, a fetch) can
 *    lose the activation, leaving a permanently suspended context. Fixed by
 *    unlocking synchronously from a capture-phase listener on the first touch.
 *
 * 3. Interruptions.
 *    A phone call, Siri, or backgrounding the tab moves the context into the
 *    non-standard 'interrupted' state. Code that only checks for 'suspended'
 *    never resumes it, so audio stays dead until reload. Fixed by treating
 *    'interrupted' like 'suspended' and resuming when the page is shown again.
 *
 * Usage:
 * ```javascript
 * iOSAudio.configureSession();              // once, at startup
 * iOSAudio.installUnlockHandlers(engine);   // once, at startup
 * iOSAudio.watchInterruptions(engine);      // once, at startup
 *
 * await iOSAudio.resumeContext(audioContext); // before playback
 * ```
 */


import { Logger } from '../core/logger.js';

// Gesture events that count as a user activation on iOS. 'touchend' fires
// after a tap completes and is the most reliable unlock point on older iOS;
// the others cover desktop, keyboard, and Apple Pencil / trackpad input.
const UNLOCK_EVENTS = ['touchend', 'pointerdown', 'mousedown', 'keydown'];

// Context states that mean "no sound will come out until you resume".
// 'interrupted' is iOS-only and absent from the Web Audio spec.
const STALLED_STATES = ['suspended', 'interrupted'];

export const iOSAudio = {
    unlocked: false,
    silentElement: null,
    handlersInstalled: false,
    interruptionsWatched: false,

    /**
     * Detect iOS/iPadOS.
     *
     * iPadOS 13+ reports a desktop Safari user agent, so the iPad is caught by
     * the touch-capable-Macintosh check rather than by name.
     *
     * @returns {boolean} True on iPhone, iPod, or iPad
     */
    isAppleMobile() {
        if (typeof navigator === 'undefined') {
            return false;
        }

        const ua = navigator.userAgent || '';

        if (/iPhone|iPad|iPod/.test(ua)) {
            return true;
        }

        // iPadOS masquerading as macOS: real Macs report maxTouchPoints 0
        return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
    },

    /**
     * Request the 'playback' audio session category.
     *
     * This is the fix for the silent switch on Safari 16.4+ (iOS 16.4, 2023).
     * 'playback' declares the audio as the point of the page rather than
     * incidental, so iOS routes it like a music app and the mute switch no
     * longer silences it. Older iOS has no such API and falls back to the
     * silent-media-element trick in `startSilentLoop()`.
     *
     * @returns {boolean} True if the session category was set
     */
    configureSession() {
        if (typeof navigator === 'undefined' || !navigator.audioSession) {
            return false;
        }

        try {
            navigator.audioSession.type = 'playback';
            Logger.log('✓ Audio session set to "playback" (ignores silent switch)');
            return true;
        } catch (error) {
            Logger.warn('Could not set audio session type:', error.message);
            return false;
        }
    },

    /**
     * True when the silent-media-element fallback is needed.
     *
     * Only old iOS qualifies: on anything with navigator.audioSession the
     * category is already set properly, and running a looping media element
     * there would needlessly occupy the Control Center now-playing slot.
     *
     * @returns {boolean} True if the legacy workaround should be used
     * @private
     */
    needsSilentLoop() {
        return this.isAppleMobile() && !(typeof navigator !== 'undefined' && navigator.audioSession);
    },

    /**
     * Build a short silent WAV as a data URI.
     *
     * Generated rather than shipped as a binary asset so the contents are
     * obvious: a standard 44-byte RIFF header followed by zeroed samples.
     *
     * @param {number} [seconds=0.25] - Clip length
     * @param {number} [sampleRate=8000] - Sample rate (low: it is silence)
     * @returns {string} A `data:audio/wav;base64,...` URI
     * @private
     */
    createSilentWav(seconds = 0.25, sampleRate = 8000) {
        const frames = Math.floor(seconds * sampleRate);
        const dataBytes = frames * 2;              // mono, 16-bit
        const buffer = new ArrayBuffer(44 + dataBytes);
        const view = new DataView(buffer);

        const writeAscii = (offset, text) => {
            for (let i = 0; i < text.length; i++) {
                view.setUint8(offset + i, text.charCodeAt(i));
            }
        };

        writeAscii(0, 'RIFF');
        view.setUint32(4, 36 + dataBytes, true);   // file size minus 8
        writeAscii(8, 'WAVE');
        writeAscii(12, 'fmt ');
        view.setUint32(16, 16, true);              // fmt chunk size
        view.setUint16(20, 1, true);               // PCM
        view.setUint16(22, 1, true);               // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);  // byte rate
        view.setUint16(32, 2, true);               // block align
        view.setUint16(34, 16, true);              // bits per sample
        writeAscii(36, 'data');
        view.setUint32(40, dataBytes, true);
        // Sample data is left at zero — that is the silence.

        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        return `data:audio/wav;base64,${btoa(binary)}`;
    },

    /**
     * Start a looping silent media element (legacy iOS silent-switch fix).
     *
     * On iOS before 16.4 there is no way to ask for an audio session category
     * directly. Keeping a media element playing makes iOS treat the page as a
     * media player and promotes the whole session — the AudioContext included —
     * out of the mute-switched 'ambient' category. The clip is real silence, so
     * nothing is added to the output.
     *
     * @private
     */
    startSilentLoop() {
        if (this.silentElement || typeof document === 'undefined') {
            return;
        }

        try {
            const element = document.createElement('audio');
            element.src = this.createSilentWav();
            element.loop = true;
            element.setAttribute('playsinline', '');   // never go fullscreen
            element.setAttribute('aria-hidden', 'true');
            element.volume = 1;                        // muting defeats the point

            const started = element.play();
            if (started && typeof started.catch === 'function') {
                started.catch(error => {
                    Logger.warn('Silent audio loop blocked:', error.message);
                });
            }

            this.silentElement = element;
            Logger.log('✓ Silent audio loop started (legacy iOS silent-switch fix)');
        } catch (error) {
            Logger.warn('Could not start silent audio loop:', error.message);
        }
    },

    /**
     * Play one frame of silence through the context.
     *
     * The canonical Web Audio unlock: iOS marks a context as user-started only
     * once a source has actually run through it, so resume() alone can leave it
     * running-but-mute on older versions.
     *
     * @param {AudioContext} audioContext - Context to unlock
     * @private
     */
    primeContext(audioContext) {
        try {
            const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        } catch (error) {
            Logger.warn('Could not prime audio context:', error.message);
        }
    },

    /**
     * Unlock audio synchronously, inside a user gesture.
     *
     * Everything here is deliberately synchronous. `resume()` returns a promise
     * but is *called* immediately; awaiting anything before this point is what
     * loses the gesture on iOS.
     *
     * @param {Object} engine - AudioEngine instance
     * @returns {boolean} True if a context is now available
     */
    unlock(engine) {
        if (!engine) {
            return false;
        }

        try {
            const audioContext = engine.ensureContextSync();

            if (STALLED_STATES.includes(audioContext.state)) {
                const resumed = audioContext.resume();
                if (resumed && typeof resumed.catch === 'function') {
                    resumed.catch(error => Logger.warn('Resume on gesture failed:', error.message));
                }
            }

            this.primeContext(audioContext);

            if (this.needsSilentLoop()) {
                this.startSilentLoop();
            }

            this.unlocked = true;
            return true;
        } catch (error) {
            Logger.error('Audio unlock failed:', error);
            return false;
        }
    },

    /**
     * Listen for the first user gesture anywhere on the page and unlock there.
     *
     * Registered in the capture phase so the context is created before any
     * application handler runs — by the time the play button's own handler
     * awaits its way to `play()`, the context already exists and is resuming.
     *
     * @param {Object} engine - AudioEngine instance
     */
    installUnlockHandlers(engine) {
        if (this.handlersInstalled || typeof document === 'undefined') {
            return;
        }

        const onGesture = () => {
            if (this.unlock(engine)) {
                UNLOCK_EVENTS.forEach(type => {
                    document.removeEventListener(type, onGesture, true);
                });
            }
        };

        UNLOCK_EVENTS.forEach(type => {
            document.addEventListener(type, onGesture, { capture: true, passive: true });
        });

        this.handlersInstalled = true;
        Logger.log('✓ Audio unlock handlers installed');
    },

    /**
     * Resume a context that is suspended or iOS-interrupted.
     *
     * @param {AudioContext} audioContext - Context to resume
     * @returns {Promise<boolean>} True if the context is usable afterwards
     */
    async resumeContext(audioContext) {
        if (!audioContext) {
            return false;
        }

        if (!STALLED_STATES.includes(audioContext.state)) {
            return true;
        }

        try {
            await audioContext.resume();
            Logger.log(`✓ Audio context resumed (was ${audioContext.state})`);
            return true;
        } catch (error) {
            Logger.error('Failed to resume audio context:', error);
            throw error;
        }
    },

    /**
     * Recover from iOS interruptions (calls, Siri, backgrounding).
     *
     * Without this the context stays 'interrupted' after the interruption ends
     * and the app is silent until the page is reloaded.
     *
     * @param {Object} engine - AudioEngine instance
     */
    watchInterruptions(engine) {
        if (this.interruptionsWatched || typeof document === 'undefined') {
            return;
        }

        const recover = () => {
            const audioContext = engine && engine.audioContext;
            if (!audioContext || !this.unlocked) {
                return;
            }
            if (STALLED_STATES.includes(audioContext.state)) {
                this.resumeContext(audioContext).catch(() => {
                    // Resuming without a gesture can legitimately fail; the next
                    // tap unlocks it again.
                });
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                recover();
            }
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('pageshow', recover);
            window.addEventListener('focus', recover);
        }

        this.interruptionsWatched = true;
    },

    /**
     * Tear down listeners and state. Used by tests.
     */
    reset() {
        if (this.silentElement) {
            this.silentElement.pause();
            this.silentElement.src = '';
            this.silentElement = null;
        }
        this.unlocked = false;
        this.handlersInstalled = false;
        this.interruptionsWatched = false;
    }
};
