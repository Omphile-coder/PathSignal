Pod::Spec.new do |s|
  s.name = 'PathSignalLidar'
  s.version = '0.1.0'
  s.summary = 'Stationary ARKit LiDAR distance reading for PathSignal'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'PathSignal'
  s.homepage = 'https://developer.apple.com/arkit/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.source_files = '**/*.swift'
  s.frameworks = 'ARKit', 'SceneKit', 'CoreVideo'
  s.dependency 'ExpoModulesCore'
  s.dependency 'onnxruntime-objc', '1.24.3'
end
