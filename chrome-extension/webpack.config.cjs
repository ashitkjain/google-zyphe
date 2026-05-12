const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

// Stamp the bundle with the build time so the side panel can display it.
// This makes "did Chrome reload my extension after the rebuild?" trivial
// to verify — if the timestamp matches the time you ran `npm run build`,
// you're on the new bundle.
const BUILD_TIME_ISO = new Date().toISOString();

module.exports = {
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    sidepanel: './src/sidepanel/sidepanel.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      __BUILD_TIME__: JSON.stringify(BUILD_TIME_ISO),
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json' },
        { from: 'src/sidepanel/index.html', to: 'sidepanel.html' },
        { from: 'src/sidepanel/sidepanel.css' },
        {
          from: 'icons',
          to: 'icons',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  resolve: {
    fallback: {
      fs: false,
      path: false,
      crypto: false,
    },
  },
  // WebLLM uses SharedArrayBuffer — extension pages support it
  experiments: {
    asyncWebAssembly: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource',
      },
    ],
  },
  optimization: {
    splitChunks: false,
  },
  // Chrome extension bundles load from local disk, so webpack's default 244 KiB
  // web-page budget doesn't apply. The bulk of sidepanel.js is @mlc-ai/web-llm.
  performance: {
    hints: false,
  },
};
