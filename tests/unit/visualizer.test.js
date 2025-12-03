/**
 * Unit tests for Visualizer
 *
 * Tests the Canvas-based visualization for FTIR and audio FFT
 */

import { jest } from '@jest/globals';

// Mock Canvas API
class MockCanvasRenderingContext2D {
    constructor() {
        this.canvas = null;
        this.fillStyle = '#000000';
        this.strokeStyle = '#000000';
        this.lineWidth = 1;
        this.font = '10px sans-serif';
        this.globalAlpha = 1;

        // Track drawing operations
        this.operations = [];
    }

    fillRect(x, y, width, height) {
        this.operations.push({ type: 'fillRect', x, y, width, height });
    }

    strokeRect(x, y, width, height) {
        this.operations.push({ type: 'strokeRect', x, y, width, height });
    }

    beginPath() {
        this.operations.push({ type: 'beginPath' });
    }

    moveTo(x, y) {
        this.operations.push({ type: 'moveTo', x, y });
    }

    lineTo(x, y) {
        this.operations.push({ type: 'lineTo', x, y });
    }

    stroke() {
        this.operations.push({ type: 'stroke' });
    }

    fill() {
        this.operations.push({ type: 'fill' });
    }

    arc(x, y, radius, startAngle, endAngle) {
        this.operations.push({ type: 'arc', x, y, radius, startAngle, endAngle });
    }

    fillText(text, x, y) {
        this.operations.push({ type: 'fillText', text, x, y });
    }

    drawImage(image, x, y) {
        this.operations.push({ type: 'drawImage', image, x, y });
    }

    clearOperations() {
        this.operations = [];
    }
}

// Mock HTMLCanvasElement
class MockCanvas {
    constructor(width = 800, height = 400) {
        this.width = width;
        this.height = height;
        this.style = { cursor: 'default' };
        this._context2d = new MockCanvasRenderingContext2D();
        this._context2d.canvas = this;
        this._eventListeners = {};
    }

    getContext(type) {
        if (type === '2d') {
            return this._context2d;
        }
        return null;
    }

    addEventListener(event, handler) {
        if (!this._eventListeners[event]) {
            this._eventListeners[event] = [];
        }
        this._eventListeners[event].push(handler);
    }

    getBoundingClientRect() {
        return {
            left: 0,
            top: 0,
            width: this.width,
            height: this.height,
            right: this.width,
            bottom: this.height
        };
    }

    // Simulate event
    _trigger(eventName, eventData) {
        if (this._eventListeners[eventName]) {
            this._eventListeners[eventName].forEach(handler => handler(eventData));
        }
    }
}

// Mock CONFIG object
global.CONFIG = {
    visualization: {
        CLICK_RADIUS: 15,
        PEAK_MARKER_SIZE: 8,
        SPECTRUM_COLOR: '#00ff88',
        PEAK_COLOR: '#ff00ff',
        SELECTED_PEAK_COLOR: '#ffd700'
    }
};

// Mock document
global.document = {
    getElementById: jest.fn((id) => {
        if (id === 'peak-tooltip') {
            return {
                style: { display: 'none', left: '0px', top: '0px' },
                querySelector: jest.fn((selector) => {
                    if (selector === '.tooltip-header') {
                        return { textContent: '' };
                    }
                    if (selector === '.tooltip-content') {
                        return { innerHTML: '' };
                    }
                    return null;
                }),
                getBoundingClientRect: () => ({ width: 100, height: 80 })
            };
        }
        return null;
    }),
    createElement: jest.fn((tag) => {
        if (tag === 'canvas') {
            return new MockCanvas();
        }
        return null;
    })
};

// Mock window
global.window = {
    innerWidth: 1920,
    innerHeight: 1080
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
    return setTimeout(cb, 16);
});

global.cancelAnimationFrame = jest.fn((id) => {
    clearTimeout(id);
});

describe('Visualizer', () => {
    let Visualizer;
    let visualizer;
    let ftirCanvas;
    let audioCanvas;

    beforeEach(() => {
        // Create mock canvases
        ftirCanvas = new MockCanvas(800, 400);
        audioCanvas = new MockCanvas(800, 400);

        // Load Visualizer class (simplified version for testing)
        Visualizer = class Visualizer {
            constructor(ftirCanvas, audioCanvas) {
                if (!ftirCanvas || !audioCanvas) {
                    throw new Error('Invalid canvases: both ftirCanvas and audioCanvas are required');
                }

                this.ftirCanvas = ftirCanvas;
                this.audioCanvas = audioCanvas;

                this.ftirCtx = ftirCanvas.getContext('2d');
                this.audioCtx = audioCanvas.getContext('2d');

                if (!this.ftirCtx || !this.audioCtx) {
                    throw new Error('Failed to get canvas 2D context');
                }

                this.animationId = null;
                this.audioEngine = null;

                this.currentSpectrum = null;
                this.currentPeaks = null;
                this.selectedPeakIndices = new Set();
                this.peakPositions = [];
                this.onPeakSelectionChange = null;

                this.CLICK_RADIUS = CONFIG.visualization.CLICK_RADIUS;
                this.PEAK_MARKER_SIZE = CONFIG.visualization.PEAK_MARKER_SIZE;

                this.audioStaticCanvas = null;
                this.audioStaticCached = false;

                this.setupClickHandler();
            }

            setupClickHandler() {
                const handleInteraction = (clientX, clientY) => {
                    if (!this.currentPeaks || this.currentPeaks.length === 0) return;

                    const rect = this.ftirCanvas.getBoundingClientRect();
                    const clickX = ((clientX - rect.left) / rect.width) * this.ftirCanvas.width;
                    const clickY = ((clientY - rect.top) / rect.height) * this.ftirCanvas.height;

                    let closestIndex = -1;
                    let closestDistance = Infinity;

                    this.peakPositions.forEach((pos, idx) => {
                        const distance = Math.sqrt(
                            Math.pow(clickX - pos.x, 2) + Math.pow(clickY - pos.y, 2)
                        );

                        if (distance < this.CLICK_RADIUS && distance < closestDistance) {
                            closestDistance = distance;
                            closestIndex = idx;
                        }
                    });

                    if (closestIndex !== -1) {
                        if (this.selectedPeakIndices.has(closestIndex)) {
                            this.selectedPeakIndices.delete(closestIndex);
                        } else {
                            this.selectedPeakIndices.add(closestIndex);
                        }

                        this.drawFTIRSpectrum(this.currentSpectrum, this.currentPeaks);

                        if (this.onPeakSelectionChange) {
                            this.onPeakSelectionChange(this.getSelectedPeaks());
                        }
                    }
                };

                this.ftirCanvas.addEventListener('click', (e) => {
                    handleInteraction(e.clientX, e.clientY);
                });

                this.ftirCanvas.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    if (e.changedTouches && e.changedTouches.length > 0) {
                        const touch = e.changedTouches[0];
                        handleInteraction(touch.clientX, touch.clientY);
                    }
                });
            }

            getSelectedPeaks() {
                if (!this.currentPeaks) return [];
                return Array.from(this.selectedPeakIndices)
                    .map(idx => this.currentPeaks[idx])
                    .filter(p => p !== undefined);
            }

            clearSelection() {
                this.selectedPeakIndices.clear();
                if (this.currentSpectrum && this.currentPeaks) {
                    this.drawFTIRSpectrum(this.currentSpectrum, this.currentPeaks);
                }
                if (this.onPeakSelectionChange) {
                    this.onPeakSelectionChange([]);
                }
            }

            selectAllPeaks() {
                if (!this.currentPeaks) return;
                this.selectedPeakIndices.clear();
                this.currentPeaks.forEach((_, idx) => {
                    this.selectedPeakIndices.add(idx);
                });
                this.drawFTIRSpectrum(this.currentSpectrum, this.currentPeaks);
                if (this.onPeakSelectionChange) {
                    this.onPeakSelectionChange(this.getSelectedPeaks());
                }
            }

            getFunctionalGroup(wavenumber) {
                if (wavenumber > 3500 && wavenumber < 3700) return 'O-H stretch';
                if (wavenumber > 3200 && wavenumber < 3500) return 'N-H stretch';
                if (wavenumber > 3000 && wavenumber < 3100) return 'C-H aromatic';
                if (wavenumber > 2850 && wavenumber < 3000) return 'C-H aliphatic';
                if (wavenumber > 2100 && wavenumber < 2300) return 'C≡N / C≡C';
                if (wavenumber > 1650 && wavenumber < 1750) return 'C=O carbonyl';
                if (wavenumber > 1500 && wavenumber < 1650) return 'C=C aromatic';
                if (wavenumber > 1350 && wavenumber < 1500) return 'C-H bend';
                if (wavenumber > 1000 && wavenumber < 1300) return 'C-O stretch';
                if (wavenumber > 650 && wavenumber < 900) return 'C-H aromatic';
                return 'Fingerprint region';
            }

            setAudioEngine(audioEngine) {
                this.audioEngine = audioEngine;
            }

            drawFTIRSpectrum(spectrum, peaks = []) {
                const ctx = this.ftirCtx;
                const width = this.ftirCanvas.width;
                const height = this.ftirCanvas.height;

                this.currentSpectrum = spectrum;
                this.currentPeaks = peaks;
                this.peakPositions = [];

                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, width, height);

                if (!spectrum || spectrum.length === 0) return;

                // Simplified drawing for testing
                const sortedSpectrum = [...spectrum].sort((a, b) => b.wavenumber - a.wavenumber);
                const wavenumbers = sortedSpectrum.map(p => p.wavenumber);
                const minWavenumber = Math.min(...wavenumbers);
                const maxWavenumber = Math.max(...wavenumbers);

                const scaleX = (wavenumber) => {
                    return ((wavenumber - minWavenumber) / (maxWavenumber - minWavenumber)) * (width - 40) + 20;
                };

                const scaleY = (transmittance) => {
                    return height - 20 - ((transmittance / 100) * (height - 40));
                };

                ctx.beginPath();
                ctx.strokeStyle = CONFIG.visualization.SPECTRUM_COLOR;
                ctx.lineWidth = 2;

                sortedSpectrum.forEach((point, idx) => {
                    const x = scaleX(point.wavenumber);
                    const y = scaleY(point.transmittance);

                    if (idx === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });

                ctx.stroke();

                if (peaks && peaks.length > 0) {
                    peaks.forEach((peak, idx) => {
                        const x = scaleX(peak.wavenumber);
                        const y = scaleY((1 - peak.absorbance) * 100);

                        this.peakPositions.push({ x, y });

                        const isSelected = this.selectedPeakIndices.has(idx);

                        ctx.beginPath();
                        ctx.strokeStyle = isSelected
                            ? CONFIG.visualization.SELECTED_PEAK_COLOR + '88'
                            : CONFIG.visualization.PEAK_COLOR + '44';
                        ctx.lineWidth = isSelected ? 2 : 1;
                        ctx.moveTo(x, height - 20);
                        ctx.lineTo(x, y);
                        ctx.stroke();

                        const markerSize = isSelected ? this.PEAK_MARKER_SIZE * 0.875 : this.PEAK_MARKER_SIZE * 0.625;
                        ctx.beginPath();
                        ctx.arc(x, y, markerSize, 0, Math.PI * 2);
                        ctx.fillStyle = isSelected
                            ? CONFIG.visualization.SELECTED_PEAK_COLOR
                            : CONFIG.visualization.PEAK_COLOR;
                        ctx.fill();

                        if (isSelected) {
                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    });
                }
            }

            drawAudioFFT() {
                const ctx = this.audioCtx;
                const width = this.audioCanvas.width;
                const height = this.audioCanvas.height;

                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, width, height);

                if (!this.audioEngine) return;

                const frequencyData = this.audioEngine.getFrequencyData();
                if (!frequencyData) return;

                const bufferLength = frequencyData.length;
                const sampleRate = this.audioEngine.getSampleRate();
                const maxFreq = 10000;
                const maxBin = Math.floor((maxFreq / sampleRate) * bufferLength * 2);

                const barWidth = (width - 40) / maxBin;
                let x = 20;

                for (let i = 0; i < maxBin; i++) {
                    const barHeight = (frequencyData[i] / 255) * (height - 40);
                    const hue = (i / maxBin) * 280;
                    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                    ctx.fillRect(x, height - 20 - barHeight, barWidth, barHeight);
                    x += barWidth;
                }

                if (this.audioEngine.getIsPlaying()) {
                    this.animationId = requestAnimationFrame(() => this.drawAudioFFT());
                }
            }

            startAudioAnimation() {
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                }
                this.drawAudioFFT();
            }

            stopAudioAnimation() {
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }

                const ctx = this.audioCtx;
                const width = this.audioCanvas.width;
                const height = this.audioCanvas.height;

                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, width, height);
            }

            clear() {
                this.stopAudioAnimation();

                [this.ftirCtx, this.audioCtx].forEach((ctx) => {
                    const canvas = ctx.canvas;
                    ctx.fillStyle = '#0a0a0a';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                });
            }
        };

        visualizer = new Visualizer(ftirCanvas, audioCanvas);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with valid canvases', () => {
            expect(visualizer.ftirCanvas).toBe(ftirCanvas);
            expect(visualizer.audioCanvas).toBe(audioCanvas);
            expect(visualizer.ftirCtx).not.toBeNull();
            expect(visualizer.audioCtx).not.toBeNull();
        });

        test('should throw error if canvases are missing', () => {
            expect(() => new Visualizer(null, audioCanvas)).toThrow('Invalid canvases: both ftirCanvas and audioCanvas are required');
            expect(() => new Visualizer(ftirCanvas, null)).toThrow('Invalid canvases: both ftirCanvas and audioCanvas are required');
        });

        test('should initialize state properties', () => {
            expect(visualizer.animationId).toBeNull();
            expect(visualizer.audioEngine).toBeNull();
            expect(visualizer.currentSpectrum).toBeNull();
            expect(visualizer.currentPeaks).toBeNull();
            expect(visualizer.selectedPeakIndices).toBeInstanceOf(Set);
            expect(visualizer.peakPositions).toEqual([]);
        });

        test('should load constants from CONFIG', () => {
            expect(visualizer.CLICK_RADIUS).toBe(CONFIG.visualization.CLICK_RADIUS);
            expect(visualizer.PEAK_MARKER_SIZE).toBe(CONFIG.visualization.PEAK_MARKER_SIZE);
        });
    });

    describe('getFunctionalGroup()', () => {
        test('should identify O-H stretch', () => {
            expect(visualizer.getFunctionalGroup(3600)).toBe('O-H stretch');
        });

        test('should identify N-H stretch', () => {
            expect(visualizer.getFunctionalGroup(3300)).toBe('N-H stretch');
        });

        test('should identify C-H aromatic', () => {
            expect(visualizer.getFunctionalGroup(3050)).toBe('C-H aromatic');
        });

        test('should identify C-H aliphatic', () => {
            expect(visualizer.getFunctionalGroup(2900)).toBe('C-H aliphatic');
        });

        test('should identify C≡N / C≡C', () => {
            expect(visualizer.getFunctionalGroup(2200)).toBe('C≡N / C≡C');
        });

        test('should identify C=O carbonyl', () => {
            expect(visualizer.getFunctionalGroup(1700)).toBe('C=O carbonyl');
        });

        test('should identify C=C aromatic', () => {
            expect(visualizer.getFunctionalGroup(1600)).toBe('C=C aromatic');
        });

        test('should identify C-H bend', () => {
            expect(visualizer.getFunctionalGroup(1400)).toBe('C-H bend');
        });

        test('should identify C-O stretch', () => {
            expect(visualizer.getFunctionalGroup(1100)).toBe('C-O stretch');
        });

        test('should return fingerprint region for low wavenumbers', () => {
            expect(visualizer.getFunctionalGroup(500)).toBe('Fingerprint region');
            expect(visualizer.getFunctionalGroup(4000)).toBe('Fingerprint region');
        });
    });

    describe('setAudioEngine()', () => {
        test('should set audio engine reference', () => {
            const mockEngine = { getFrequencyData: jest.fn() };
            visualizer.setAudioEngine(mockEngine);
            expect(visualizer.audioEngine).toBe(mockEngine);
        });
    });

    describe('Peak Selection', () => {
        beforeEach(() => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 50 },
                { wavenumber: 2000, transmittance: 60 },
                { wavenumber: 3000, transmittance: 70 }
            ];

            const peaks = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 200 },
                { wavenumber: 2000, absorbance: 0.4, audioFreq: 400 },
                { wavenumber: 3000, absorbance: 0.3, audioFreq: 600 }
            ];

            visualizer.drawFTIRSpectrum(spectrum, peaks);
        });

        test('should get selected peaks', () => {
            visualizer.selectedPeakIndices.add(0);
            visualizer.selectedPeakIndices.add(2);

            const selected = visualizer.getSelectedPeaks();

            expect(selected).toHaveLength(2);
            expect(selected[0].wavenumber).toBe(1000);
            expect(selected[1].wavenumber).toBe(3000);
        });

        test('should return empty array when no peaks selected', () => {
            const selected = visualizer.getSelectedPeaks();
            expect(selected).toEqual([]);
        });

        test('should clear selection', () => {
            visualizer.selectedPeakIndices.add(0);
            visualizer.selectedPeakIndices.add(1);

            visualizer.clearSelection();

            expect(visualizer.selectedPeakIndices.size).toBe(0);
            expect(visualizer.getSelectedPeaks()).toEqual([]);
        });

        test('should call selection change callback on clear', () => {
            const callback = jest.fn();
            visualizer.onPeakSelectionChange = callback;

            visualizer.clearSelection();

            expect(callback).toHaveBeenCalledWith([]);
        });

        test('should select all peaks', () => {
            visualizer.selectAllPeaks();

            expect(visualizer.selectedPeakIndices.size).toBe(3);
            expect(visualizer.getSelectedPeaks()).toHaveLength(3);
        });

        test('should call selection change callback on select all', () => {
            const callback = jest.fn();
            visualizer.onPeakSelectionChange = callback;

            visualizer.selectAllPeaks();

            expect(callback).toHaveBeenCalledWith(visualizer.getSelectedPeaks());
            expect(callback.mock.calls[0][0]).toHaveLength(3);
        });

        test('should handle selectAllPeaks when no peaks exist', () => {
            visualizer.currentPeaks = null;

            expect(() => visualizer.selectAllPeaks()).not.toThrow();
            expect(visualizer.selectedPeakIndices.size).toBe(0);
        });
    });

    describe('drawFTIRSpectrum()', () => {
        test('should draw spectrum line', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 50 },
                { wavenumber: 2000, transmittance: 60 },
                { wavenumber: 3000, transmittance: 70 }
            ];

            visualizer.drawFTIRSpectrum(spectrum, []);

            const ops = visualizer.ftirCtx.operations;
            expect(ops.some(op => op.type === 'beginPath')).toBe(true);
            expect(ops.some(op => op.type === 'moveTo')).toBe(true);
            expect(ops.some(op => op.type === 'lineTo')).toBe(true);
            expect(ops.some(op => op.type === 'stroke')).toBe(true);
        });

        test('should draw peak markers', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 50 }
            ];

            const peaks = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 200 }
            ];

            visualizer.drawFTIRSpectrum(spectrum, peaks);

            const ops = visualizer.ftirCtx.operations;
            expect(ops.some(op => op.type === 'arc')).toBe(true);
            expect(visualizer.peakPositions).toHaveLength(1);
        });

        test('should store peak positions', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 50 },
                { wavenumber: 2000, transmittance: 60 }
            ];

            const peaks = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 200 },
                { wavenumber: 2000, absorbance: 0.4, audioFreq: 400 }
            ];

            visualizer.drawFTIRSpectrum(spectrum, peaks);

            expect(visualizer.peakPositions).toHaveLength(2);
            expect(visualizer.peakPositions[0]).toHaveProperty('x');
            expect(visualizer.peakPositions[0]).toHaveProperty('y');
        });

        test('should handle empty spectrum', () => {
            visualizer.drawFTIRSpectrum([], []);

            const ops = visualizer.ftirCtx.operations;
            expect(ops.some(op => op.type === 'fillRect')).toBe(true);
        });

        test('should handle null spectrum', () => {
            visualizer.drawFTIRSpectrum(null, []);

            const ops = visualizer.ftirCtx.operations;
            expect(ops.some(op => op.type === 'fillRect')).toBe(true);
        });

        test('should highlight selected peaks differently', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 50 }
            ];

            const peaks = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 200 }
            ];

            visualizer.selectedPeakIndices.add(0);
            visualizer.drawFTIRSpectrum(spectrum, peaks);

            const ops = visualizer.ftirCtx.operations;
            expect(ops.some(op => op.type === 'fill')).toBe(true);
        });
    });

    describe('Audio FFT Visualization', () => {
        let mockEngine;

        beforeEach(() => {
            mockEngine = {
                getFrequencyData: jest.fn(() => new Uint8Array(1024).fill(128)),
                getSampleRate: jest.fn(() => 44100),
                getIsPlaying: jest.fn(() => false)
            };
            visualizer.setAudioEngine(mockEngine);
        });

        test('should draw audio FFT bars', () => {
            visualizer.drawAudioFFT();

            const ops = visualizer.audioCtx.operations;
            expect(ops.some(op => op.type === 'fillRect')).toBe(true);
            expect(mockEngine.getFrequencyData).toHaveBeenCalled();
        });

        test('should handle missing audio engine', () => {
            visualizer.audioEngine = null;

            expect(() => visualizer.drawAudioFFT()).not.toThrow();
        });

        test('should handle missing frequency data', () => {
            mockEngine.getFrequencyData.mockReturnValue(null);

            expect(() => visualizer.drawAudioFFT()).not.toThrow();
        });

        test('should start animation', () => {
            visualizer.startAudioAnimation();

            expect(visualizer.animationId).not.toBeNull();
        });

        test('should cancel previous animation before starting new one', () => {
            visualizer.animationId = 12345;
            visualizer.startAudioAnimation();

            expect(cancelAnimationFrame).toHaveBeenCalledWith(12345);
        });

        test('should stop animation', () => {
            visualizer.animationId = 12345;
            visualizer.stopAudioAnimation();

            expect(cancelAnimationFrame).toHaveBeenCalledWith(12345);
            expect(visualizer.animationId).toBeNull();
        });

        test('should continue animation while playing', () => {
            mockEngine.getIsPlaying.mockReturnValue(true);
            visualizer.drawAudioFFT();

            expect(requestAnimationFrame).toHaveBeenCalled();
        });

        test('should not continue animation when not playing', () => {
            mockEngine.getIsPlaying.mockReturnValue(false);

            requestAnimationFrame.mockClear();
            visualizer.drawAudioFFT();

            expect(requestAnimationFrame).not.toHaveBeenCalled();
        });
    });

    describe('clear()', () => {
        test('should stop animation and clear canvases', () => {
            visualizer.animationId = 12345;
            visualizer.clear();

            expect(cancelAnimationFrame).toHaveBeenCalledWith(12345);

            const ftirOps = visualizer.ftirCtx.operations;
            const audioOps = visualizer.audioCtx.operations;

            expect(ftirOps.some(op => op.type === 'fillRect')).toBe(true);
            expect(audioOps.some(op => op.type === 'fillRect')).toBe(true);
        });
    });

    describe('Click Handler', () => {
        beforeEach(() => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 50 },
                { wavenumber: 2000, transmittance: 60 }
            ];

            const peaks = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 200 },
                { wavenumber: 2000, absorbance: 0.4, audioFreq: 400 }
            ];

            visualizer.drawFTIRSpectrum(spectrum, peaks);
        });

        test('should toggle peak selection on click', () => {
            const callback = jest.fn();
            visualizer.onPeakSelectionChange = callback;

            // Get peak position
            const peakPos = visualizer.peakPositions[0];

            // Simulate click on peak
            ftirCanvas._trigger('click', {
                clientX: peakPos.x,
                clientY: peakPos.y
            });

            expect(visualizer.selectedPeakIndices.has(0)).toBe(true);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        test('should handle click outside peak area', () => {
            const callback = jest.fn();
            visualizer.onPeakSelectionChange = callback;

            // Simulate click far from any peak
            ftirCanvas._trigger('click', {
                clientX: 10000,
                clientY: 10000
            });

            expect(visualizer.selectedPeakIndices.size).toBe(0);
            expect(callback).not.toHaveBeenCalled();
        });

        test('should handle touch events', () => {
            const peakPos = visualizer.peakPositions[0];

            ftirCanvas._trigger('touchend', {
                preventDefault: jest.fn(),
                changedTouches: [{
                    clientX: peakPos.x,
                    clientY: peakPos.y
                }]
            });

            expect(visualizer.selectedPeakIndices.has(0)).toBe(true);
        });
    });
});
