const { getDefaultConfig } = require('expo/metro-config')
const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('bin', 'onnx')
module.exports = config
