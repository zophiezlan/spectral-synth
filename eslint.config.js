import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                // Application globals
                CONFIG: 'readonly',
                CONSTANTS: 'readonly',
                DOM: 'readonly',
                FrequencyMapper: 'readonly',
                AudioEngine: 'readonly',
                Visualizer: 'readonly',
                CSVImporter: 'readonly',
                JCAMPImporter: 'readonly',
                MP3Encoder: 'readonly',
                MIDIOutput: 'readonly',
                LoadingOverlay: 'readonly',
                Toast: 'readonly',
                ScreenReader: 'readonly',
                ErrorHandler: 'readonly',
                ThumbnailGenerator: 'readonly',
                ColorMapper: 'readonly',
                ResponsiveCanvas: 'readonly',
                StorageUtilities: 'readonly',
                DataLoader: 'readonly',
                TutorialManager: 'readonly',
                AnalysisUtilities: 'readonly',
                SubstanceUtilities: 'readonly',
                PerformanceUtilities: 'readonly',
                PerformanceMonitor: 'readonly',
                EventHandlers: 'readonly',
                ImportExportHandlers: 'readonly',
                MIDIHandlers: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', {
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_'
            }],
            'no-console': ['warn', {
                allow: ['warn', 'error', 'info']
            }],
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['error', 'always'],
            'curly': ['error', 'all'],
            'brace-style': ['error', '1tbs'],
            'indent': ['error', 4, {
                'SwitchCase': 1
            }],
            'quotes': ['error', 'single', {
                'avoidEscape': true,
                'allowTemplateLiterals': true
            }],
            'semi': ['error', 'always'],
            'no-trailing-spaces': 'error',
            'no-multiple-empty-lines': ['error', {
                'max': 2,
                'maxEOF': 1
            }]
        }
    },
    {
        ignores: [
            'node_modules/**',
            'data/**',
            'docs/**',
            '.git/**',
            'scripts/enfsi_data/**'
        ]
    }
];
