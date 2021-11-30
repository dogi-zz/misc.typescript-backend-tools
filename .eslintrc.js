module.exports = {
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2015,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "env": {
    "browser": false,
    "node": true,
    "es6": true
  },
  "globals": {
    "document": "readonly",
    "cy": "readonly",
    "Cypress": "readonly",
    "describe": "readonly",
    "it": "readonly",
    "beforeEach": "readonly",
    "expect": "readonly"
  },
  "rules": {
    "no-sequences": "error",
    "semi": "warn",
    "quotes": [1, "single", { "avoidEscape": true }],
    "prefer-const": "warn",
    "no-unused-vars": "warn"
  }
};