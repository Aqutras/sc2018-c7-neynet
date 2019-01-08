module.exports = {
  'extends': [
    'airbnb',
    'prettier',
    'prettier/standard',
  ],
  'env': {
    es6: true,
    node: true,
  },
  'rules': {
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'prettier/prettier': 'error',
  },
  'plugins': [
    'prettier',
  ],
}