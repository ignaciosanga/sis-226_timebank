module.exports = {
  preset: 'ts-jest',
  rootDir: '..',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.cjs'],
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  clearMocks: true,
};
