import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import _import from 'eslint-plugin-import';
import promise from 'eslint-plugin-promise';
import unicorn from 'eslint-plugin-unicorn';
import sonarjs from 'eslint-plugin-sonarjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ['eslint.config.mjs', 'dump.js', 'dist', 'coverage', 'data']
  },
  ...fixupConfigRules(
    compat.extends(
      'prettier',
      'eslint:recommended',
      'plugin:@typescript-eslint/strict-type-checked',
      'plugin:@typescript-eslint/stylistic-type-checked',
      'plugin:import/recommended',
      'plugin:promise/recommended',
      'plugin:unicorn/recommended',
      'plugin:sonarjs/recommended-legacy'
    )
  ),
  {
    plugins: {
      import: fixupPluginRules(_import),
      promise: fixupPluginRules(promise),
      unicorn: fixupPluginRules(unicorn),
      sonarjs: fixupPluginRules(sonarjs)
    },

    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',

      parserOptions: {
        project: 'tsconfig.json'
      }
    },

    settings: {
      'import/resolver': {
        typescript: {}
      }
    },

    rules: {
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prevent-abbreviations': 'off',

      'promise/always-return': ['error', { ignoreLastCallback: true }],

      'spaced-comment': [
        'error',
        'always',
        {
          exceptions: ['-'],
          markers: ['/']
        }
      ],

      'arrow-parens': ['error', 'as-needed'],
      'arrow-body-style': ['error', 'as-needed'],
      'no-restricted-syntax': ['error', 'FunctionDeclaration'],

      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0,
          maxBOF: 0
        }
      ],

      'linebreak-style': ['error', 'unix'],
      'eol-last': ['error', 'always'],
      'prefer-destructuring': ['error'],

      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true
        }
      ],

      'comma-dangle': ['error', 'never'],
      'no-console': ['error'],

      'import/newline-after-import': [
        'error',
        {
          count: 1
        }
      ],

      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true
        }
      ],

      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling']],
          'newlines-between': 'always',

          alphabetize: {
            order: 'asc',
            caseInsensitive: false
          }
        }
      ]
    }
  }
];
