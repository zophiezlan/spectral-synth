/**
 * Unit Tests for iOSAudio Module
 *
 * Covers the three iOS-only failure modes that leave the synthesiser silent:
 * the ringer switch (audio session category), the user-gesture requirement
 * (synchronous context creation), and interruptions (the 'interrupted' state).
 * Uses the mocked Web Audio API from setup.js.
 */

import { jest } from '@jest/globals';
import { iOSAudio } from '../src/audio/ios-audio.js';
import { AudioEngine } from '../src/audio/audio-engine.js';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** Override a navigator property for the duration of a test. */
function setNavigator(prop, value) {
    Object.defineProperty(navigator, prop, { value, configurable: true, writable: true });
}

describe('iOSAudio', () => {
    let engine;

    beforeEach(() => {
        engine = new AudioEngine();
        iOSAudio.reset();
        setNavigator('userAgent', DESKTOP_UA);
        setNavigator('maxTouchPoints', 0);
        delete navigator.audioSession;
    });

    afterEach(() => {
        iOSAudio.reset();
    });

    describe('isAppleMobile', () => {
        it('should detect an iPhone', () => {
            setNavigator('userAgent', IPHONE_UA);
            expect(iOSAudio.isAppleMobile()).toBe(true);
        });

        it('should detect an iPad reporting a desktop user agent', () => {
            // iPadOS 13+ claims to be macOS; only the touch points give it away
            setNavigator('userAgent', IPAD_DESKTOP_UA);
            setNavigator('maxTouchPoints', 5);
            expect(iOSAudio.isAppleMobile()).toBe(true);
        });

        it('should not flag a real Mac', () => {
            setNavigator('userAgent', IPAD_DESKTOP_UA);
            setNavigator('maxTouchPoints', 0);
            expect(iOSAudio.isAppleMobile()).toBe(false);
        });

        it('should not flag a desktop browser', () => {
            expect(iOSAudio.isAppleMobile()).toBe(false);
        });
    });

    describe('configureSession', () => {
        it('should set the session type to playback so the silent switch is ignored', () => {
            setNavigator('audioSession', { type: 'auto' });

            expect(iOSAudio.configureSession()).toBe(true);
            expect(navigator.audioSession.type).toBe('playback');
        });

        it('should report failure when the API is unavailable', () => {
            expect(iOSAudio.configureSession()).toBe(false);
        });

        it('should not throw when setting the type is rejected', () => {
            setNavigator('audioSession', {
                set type(_value) {
                    throw new Error('not allowed');
                },
                get type() {
                    return 'auto';
                }
            });

            expect(iOSAudio.configureSession()).toBe(false);
        });
    });

    describe('needsSilentLoop', () => {
        it('should be true on iOS without the audio session API', () => {
            setNavigator('userAgent', IPHONE_UA);
            expect(iOSAudio.needsSilentLoop()).toBe(true);
        });

        it('should be false on iOS with the audio session API', () => {
            setNavigator('userAgent', IPHONE_UA);
            setNavigator('audioSession', { type: 'auto' });
            expect(iOSAudio.needsSilentLoop()).toBe(false);
        });

        it('should be false off iOS', () => {
            expect(iOSAudio.needsSilentLoop()).toBe(false);
        });
    });

    describe('createSilentWav', () => {
        it('should produce a base64 WAV data URI', () => {
            const uri = iOSAudio.createSilentWav();
            expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
        });

        it('should write a valid RIFF/WAVE header', () => {
            const uri = iOSAudio.createSilentWav(0.1, 8000);
            const binary = atob(uri.split(',')[1]);

            expect(binary.slice(0, 4)).toBe('RIFF');
            expect(binary.slice(8, 12)).toBe('WAVE');
            expect(binary.slice(12, 16)).toBe('fmt ');
            expect(binary.slice(36, 40)).toBe('data');
        });

        it('should size the payload from duration and sample rate', () => {
            const uri = iOSAudio.createSilentWav(0.1, 8000);
            const binary = atob(uri.split(',')[1]);

            // 800 mono frames at 16-bit = 1600 bytes, plus the 44-byte header
            expect(binary.length).toBe(44 + 1600);
        });

        it('should contain nothing but silence', () => {
            const uri = iOSAudio.createSilentWav(0.05, 8000);
            const binary = atob(uri.split(',')[1]);
            const samples = binary.slice(44);

            expect([...samples].every(char => char.charCodeAt(0) === 0)).toBe(true);
        });
    });

    describe('unlock', () => {
        it('should create the audio context synchronously', () => {
            // No await: iOS drops the gesture activation if the context is
            // created in a later task than the tap that triggered it.
            iOSAudio.unlock(engine);

            expect(engine.audioContext).not.toBeNull();
            expect(iOSAudio.unlocked).toBe(true);
        });

        it('should resume a suspended context', () => {
            engine.ensureContextSync();
            engine.audioContext.state = 'suspended';

            iOSAudio.unlock(engine);

            expect(engine.audioContext.state).toBe('running');
        });

        it('should resume an iOS-interrupted context', () => {
            engine.ensureContextSync();
            engine.audioContext.state = 'interrupted';

            iOSAudio.unlock(engine);

            expect(engine.audioContext.state).toBe('running');
        });

        it('should play a silent buffer to prime the context', () => {
            engine.ensureContextSync();
            const spy = jest.spyOn(engine.audioContext, 'createBufferSource');

            iOSAudio.unlock(engine);

            expect(spy).toHaveBeenCalled();
        });

        it('should return false without an engine', () => {
            expect(iOSAudio.unlock(null)).toBe(false);
        });

        it('should not start the silent loop off iOS', () => {
            iOSAudio.unlock(engine);
            expect(iOSAudio.silentElement).toBeNull();
        });
    });

    describe('installUnlockHandlers', () => {
        it('should unlock on the first touch', () => {
            iOSAudio.installUnlockHandlers(engine);
            expect(engine.audioContext).toBeNull();

            document.dispatchEvent(new Event('touchend'));

            expect(engine.audioContext).not.toBeNull();
        });

        it('should unlock on a pointer gesture', () => {
            iOSAudio.installUnlockHandlers(engine);
            document.dispatchEvent(new Event('pointerdown'));

            expect(iOSAudio.unlocked).toBe(true);
        });

        it('should stop listening once unlocked', () => {
            iOSAudio.installUnlockHandlers(engine);
            document.dispatchEvent(new Event('touchend'));

            const first = engine.audioContext;
            document.dispatchEvent(new Event('touchend'));

            expect(engine.audioContext).toBe(first);
        });

        it('should only install once', () => {
            const spy = jest.spyOn(document, 'addEventListener');

            iOSAudio.installUnlockHandlers(engine);
            const afterFirst = spy.mock.calls.length;
            iOSAudio.installUnlockHandlers(engine);

            expect(spy.mock.calls.length).toBe(afterFirst);
            spy.mockRestore();
        });
    });

    describe('resumeContext', () => {
        it('should resume a suspended context', async () => {
            engine.ensureContextSync();
            engine.audioContext.state = 'suspended';

            await expect(iOSAudio.resumeContext(engine.audioContext)).resolves.toBe(true);
            expect(engine.audioContext.state).toBe('running');
        });

        it('should resume an interrupted context', async () => {
            engine.ensureContextSync();
            engine.audioContext.state = 'interrupted';

            await expect(iOSAudio.resumeContext(engine.audioContext)).resolves.toBe(true);
            expect(engine.audioContext.state).toBe('running');
        });

        it('should leave a running context alone', async () => {
            engine.ensureContextSync();
            const spy = jest.spyOn(engine.audioContext, 'resume');

            await iOSAudio.resumeContext(engine.audioContext);

            expect(spy).not.toHaveBeenCalled();
        });

        it('should return false without a context', async () => {
            await expect(iOSAudio.resumeContext(null)).resolves.toBe(false);
        });

        it('should propagate a resume failure', async () => {
            engine.ensureContextSync();
            engine.audioContext.state = 'suspended';
            engine.audioContext.resume = () => Promise.reject(new Error('blocked'));

            await expect(iOSAudio.resumeContext(engine.audioContext)).rejects.toThrow('blocked');
        });
    });

    describe('watchInterruptions', () => {
        it('should resume an interrupted context when the page becomes visible', async () => {
            iOSAudio.unlock(engine);
            iOSAudio.watchInterruptions(engine);
            engine.audioContext.state = 'interrupted';

            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();

            expect(engine.audioContext.state).toBe('running');
        });

        it('should do nothing before the first unlock', async () => {
            engine.ensureContextSync();
            engine.audioContext.state = 'interrupted';
            iOSAudio.watchInterruptions(engine);

            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();

            expect(engine.audioContext.state).toBe('interrupted');
        });
    });
});
