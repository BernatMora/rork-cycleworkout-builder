/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/utils/punisher/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          strict: false,
          esModuleInterop: true,
          paths: { '@/*': ['./*'] },
        },
      },
    ],
  },
  moduleNameMapper: {
    // Mock react-native for pure-logic tests
    '^react-native$': '<rootDir>/utils/punisher/__tests__/__mocks__/react-native.js',
  },
};
