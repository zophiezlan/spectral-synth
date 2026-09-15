export default {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    // Source is native ESM; run with --experimental-vm-modules (see package.json)
    transform: {},
    coverageProvider: 'v8',
    collectCoverageFrom: ['src/**/*.js'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true
};
