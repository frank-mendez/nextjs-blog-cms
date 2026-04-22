import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Classic react-hooks rules only (not v7 React Compiler rules)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    // e2e files use Playwright's `use` callback which is not a React hook
    files: ['e2e/**/*.ts', 'e2e/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
]
