const path = require('path');
const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  mode: nodeEnv,
  context: path.resolve(__dirname, 'scripts'),
  entry: {
    entries: [
      './branchingPython.js',
      './genericScreen.js',
      './libraryScreen.js',
      './libraryScreenOverlay.js',
      './scoring.js'
    ]
  },
  devtool: (nodeEnv == 'development') ? 'eval-source-map' : false,
  output: {
    filename: 'dist.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
    ]
  }
};
