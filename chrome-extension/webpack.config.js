const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

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
};
