module.exports = {
    env: {
        es6: true,
        node: true,
    },
    parserOptions: {
        "ecmaVersion": 2022,
    },
    extends: [
        "eslint:recommended",
        "google",
    ],
    rules: {
        "no-restricted-globals": ["error", "name", "length"],
        "prefer-arrow-callback": "error",
        "quotes": ["error", "double", { "allowTemplateLiterals": true }],
        "object-curly-spacing": ["error", "always"],
        "max-len": ["error", { "code": 500 }],
        "indent": ["error", 4],
        "require-jsdoc": "off",
        "valid-jsdoc": "off",
        "no-unused-vars": "off",
    },
    overrides: [
        {
            files: ["**/*.spec.js"],
            env: {
                mocha: true,
            },
            rules: {},
        },
    ],
    globals: {},
};
