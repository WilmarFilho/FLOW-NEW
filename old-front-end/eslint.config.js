import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser, 
        ...globals.node,   
      },
    },
  },
  
  {
    rules: {
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],
    },
  },

  {
    files: ['**/*.{jsx,tsx}'],
    ...pluginReact.configs.flat.recommended,    
    ...pluginReact.configs.flat['jsx-runtime'], 
    settings: {
      react: {
        version: 'detect', 
      },
    },
  },
]);