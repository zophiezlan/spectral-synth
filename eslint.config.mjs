/**
 * ESLint Configuration (v9 format)
 * 
 * Migrated from .eslintrc.json to support ESLint v9+
 */

import js from '@eslint/js';

export default [
    {
        ignores: [
            'tests/**',
            'node_modules/**',
            '*.min.js',
            'sw-register.js',
            'sw.js',
            'jest.config.js',
            'eslint.config.js',
            'build-library.js',
            'dist/**',
            'coverage/**'
        ]
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                // Browser environment
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                fetch: 'readonly',
                URLSearchParams: 'readonly',
                AudioContext: 'readonly',
                webkitAudioContext: 'readonly',
                OfflineAudioContext: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                FileReader: 'readonly',
                URL: 'readonly',
                IntersectionObserver: 'readonly',
                confirm: 'readonly',
                alert: 'readonly',
                prompt: 'readonly',
                
                // Configuration and constants
                CONFIG: 'readonly',
                CONSTANTS: 'readonly',
                
                // Utility modules
                Logger: 'readonly',
                Toast: 'readonly',
                ErrorHandler: 'readonly',
                LoadingOverlay: 'readonly',
                ScreenReader: 'readonly',
                BrowserCompatibility: 'readonly',
                ResponsiveCanvas: 'readonly',
                MicroInteractions: 'readonly',
                iOSAudioHelper: 'readonly',
                ColorMapper: 'readonly',
                
                // Core modules
                AudioEngine: 'readonly',
                FrequencyMapper: 'readonly',
                Visualizer: 'readonly',
                MIDIOutput: 'readonly',
                CSVImporter: 'readonly',
                JCAMPImporter: 'readonly',
                MP3Encoder: 'readonly',
                
                // Feature modules
                Favorites: 'readonly',
                KeyboardShortcuts: 'readonly',
                ModalManager: 'readonly',
                FilterManager: 'readonly',
                TutorialManager: 'readonly',
                Onboarding: 'readonly',
                SmartSuggestions: 'readonly',
                AppState: 'readonly',
                PlaybackController: 'readonly',
                ThemeManager: 'readonly',
                
                // Event handlers
                setupEventListeners: 'readonly',
                categorizeSubstance: 'readonly',
                calculateSpectralSimilarity: 'readonly',
                handleSubstanceChange: 'readonly',
                handleSearch: 'readonly',
                handleCategoryChange: 'readonly',
                handlePlay: 'readonly',
                handleStop: 'readonly',
                handleSelectAll: 'readonly',
                handleClearSelection: 'readonly',
                handleKeyboardShortcut: 'readonly',
                handleFavoritesFilterChange: 'readonly',
                handleFavoriteToggle: 'readonly',
                populateSubstanceSelector: 'readonly',
                updateFavoritesList: 'readonly',
                
                // Import/Export handlers
                handleCSVImport: 'readonly',
                handleJCAMPImport: 'readonly',
                handleExportWAV: 'readonly',
                handleExportMP3: 'readonly',
                
                // MIDI handlers
                handleSendMIDI: 'readonly',
                handleExportMIDIFile: 'readonly',
                refreshMIDIDevices: 'readonly',
                updateMIDISendButton: 'readonly',
                
                // DOM elements (exported from dom-elements.js)
                durationValue: 'readonly',
                volumeSlider: 'readonly',
                volumeValue: 'readonly',
                reverbSlider: 'readonly',
                reverbValue: 'readonly',
                filterFreqSlider: 'readonly',
                filterFreqValue: 'readonly',
                attackSlider: 'readonly',
                attackValue: 'readonly',
                decaySlider: 'readonly',
                decayValue: 'readonly',
                sustainSlider: 'readonly',
                sustainValue: 'readonly',
                releaseSlider: 'readonly',
                releaseValue: 'readonly',
                adsrCurveSelect: 'readonly',
                substanceSelect: 'readonly',
                searchInput: 'readonly',
                categorySelect: 'readonly',
                resultsCount: 'readonly',
                playButton: 'readonly',
                selectAllButton: 'readonly',
                clearSelectionButton: 'readonly',
                selectionCount: 'readonly',
                mappingInfo: 'readonly',
                mappingInfoModal: 'readonly',
                durationSlider: 'readonly',
                ftirCanvas: 'readonly',
                audioCanvas: 'readonly',
                
                // Third-party libraries
                lamejs: 'readonly',
                
                // Writable globals (for instances)
                visualizer: 'writable',
                visualizerA: 'writable',
                visualizerB: 'writable',
                audioEngine: 'writable',
                frequencyMapper: 'writable',
                midiOutput: 'writable'
            }
        },
        rules: {
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            'no-console': 'off',
            'no-redeclare': 'off',
            'semi': ['error', 'always'],
            'quotes': ['warn', 'single', { avoidEscape: true }],
            'indent': ['warn', 4, { SwitchCase: 1 }],
            'no-trailing-spaces': 'warn',
            'eol-last': ['warn', 'always'],
            'no-multiple-empty-lines': ['warn', { max: 2 }],
            'comma-dangle': ['warn', 'only-multiline'],
            'eqeqeq': ['warn', 'smart'],
            'curly': ['warn', 'multi-line'],
            'brace-style': ['warn', '1tbs', { allowSingleLine: true }],
            'no-var': 'warn',
            'prefer-const': 'warn'
        }
    },
    // Node.js files (build scripts)
    {
        files: ['build.js', 'build-library.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                // Node.js environment
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                global: 'readonly'
            }
        }
    },
    // Service Worker files
    {
        files: ['service-worker.js', 'sw-register.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                // Service Worker globals
                self: 'readonly',
                caches: 'readonly',
                clients: 'readonly',
                location: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                Response: 'readonly',
                Request: 'readonly'
            }
        }
    }
];
