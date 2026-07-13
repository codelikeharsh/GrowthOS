import nextConfig from 'eslint-config-next/core-web-vitals'
import tsConfig from 'eslint-config-next/typescript'

export default [
  ...nextConfig,
  ...tsConfig,
  { ignores: ['.next/**', 'coverage/**', 'next-env.d.ts'] },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]
