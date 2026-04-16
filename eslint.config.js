/**
 * LevelUp ESLint config with custom rules for tenant safety and design system enforcement.
 */

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**'],
  },
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    rules: {
      // no-cross-tenant: Business packages must not import system-db
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/system-db*', '**/system.db*'],
          message: 'Business packages must not import system-db. Use TenantContext instead.',
        }],
      }],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx', 'apps/web/src/**/*.ts'],
    rules: {
      // Warn on hex colors in JSX (should use CSS variables)
      'no-restricted-syntax': ['warn',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Use CSS variables (--bg-0, --fg-0, etc.) instead of hex colors.',
        },
      ],
    },
  },
];
