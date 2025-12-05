module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    collectCoverageFrom: [
        '*.js',
        '!jest.config.js',
        '!build-library.js',
        '!build.js',
        '!service-worker.js',
        '!sw-register.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true
};
