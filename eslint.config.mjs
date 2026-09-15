/**
 * ESLint Configuration (flat config)
 *
 * Everything is an ES module now, so there is no list of app globals here:
 * an identifier that isn't imported or declared is a real `no-undef` error.
 */

import js from '@eslint/js';
import globals from 'globals';

const styleRules = {
    'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
    }],
    'no-console': 'off',
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
};

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'midi-export/**'
        ]
    },
    js.configs.recommended,

    // Browser application modules
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                lamejs: 'readonly' // optional MP3 encoder, loaded from a <script> if present
            }
        },
        rules: styleRules
    },

    // Service worker (classic script, not a module)
    {
        files: ['service-worker.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: globals.serviceworker
        },
        rules: styleRules
    },

    // Node.js build/data scripts
    {
        files: ['scripts/**/*.js', 'jest.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node
        },
        rules: styleRules
    },

    // Jest tests (native ESM)
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node, ...globals.jest }
        },
        rules: styleRules
    }
];
