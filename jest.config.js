export default {
    testEnvironment: 'jsdom',
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/pwa/**',
        '!src/config/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 10000,
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    moduleFileExtensions: ['js', 'json'],
    transform: {},
    globals: {
        CONFIG: {},
        CONSTANTS: {}
    }
};
