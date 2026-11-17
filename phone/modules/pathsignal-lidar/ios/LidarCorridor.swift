import ARKit
import CoreVideo
import simd

struct LidarCorridor {
  // Compact triples in centimetres: ahead of the camera, lateral, height above the floor.
  static func sample(frame: ARFrame, depth: ARDepthData, floor: Float) -> [Int]? {
    let pose = frame.camera.transform
    let forward = SIMD2<Float>(-pose.columns.2.x, -pose.columns.2.z)
    guard simd_length(forward) > 0.35 else { return nil }
    let heading = simd_normalize(forward)
    let right = SIMD2<Float>(-heading.y, heading.x)
    let camera = pose.columns.3
    guard (0.45 ... 2.2).contains(camera.y - floor) else { return nil }

    let map = depth.depthMap
    guard let confidence = depth.confidenceMap,
          CVPixelBufferGetPixelFormatType(map) == kCVPixelFormatType_DepthFloat32,
          CVPixelBufferGetPixelFormatType(confidence) == kCVPixelFormatType_OneComponent8
    else { return nil }
    let width = CVPixelBufferGetWidth(map)
    let height = CVPixelBufferGetHeight(map)
    guard width > 0, height > 0, CVPixelBufferGetWidth(confidence) == width,
          CVPixelBufferGetHeight(confidence) == height else { return nil }

    guard CVPixelBufferLockBaseAddress(map, .readOnly) == kCVReturnSuccess else { return nil }
    defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
    guard CVPixelBufferLockBaseAddress(confidence, .readOnly) == kCVReturnSuccess else { return nil }
    defer { CVPixelBufferUnlockBaseAddress(confidence, .readOnly) }
    guard let depths = CVPixelBufferGetBaseAddress(map),
          let qualities = CVPixelBufferGetBaseAddress(confidence) else { return nil }

    let intrinsics = frame.camera.intrinsics
    let focal = SIMD2<Float>(intrinsics.columns.0.x, intrinsics.columns.1.y)
    let principal = SIMD2<Float>(intrinsics.columns.2.x, intrinsics.columns.2.y)
    let scale = SIMD2<Float>(Float(frame.camera.imageResolution.width) / Float(width),
                             Float(frame.camera.imageResolution.height) / Float(height))
    guard focal.x > 0, focal.y > 0 else { return nil }

    var points: [Int] = []
    let depthStride = CVPixelBufferGetBytesPerRow(map)
    let confidenceStride = CVPixelBufferGetBytesPerRow(confidence)
    for y in stride(from: 1, to: height, by: 3) {
      let row = depths.advanced(by: y * depthStride).assumingMemoryBound(to: Float.self)
      let quality = qualities.advanced(by: y * confidenceStride).assumingMemoryBound(to: UInt8.self)
      for x in stride(from: 1, to: width, by: 3) {
        let z = row[x]
        guard Int(quality[x]) >= ARConfidenceLevel.medium.rawValue,
              z.isFinite, (0.20 ... 4.0).contains(z) else { continue }
        let pixel = SIMD2<Float>(Float(x) + 0.5, Float(y) + 0.5) * scale
        let ray = (pixel - principal) / focal
        let world = pose * SIMD4<Float>(ray.x * z, -ray.y * z, -z, 1)
        let horizontal = SIMD2<Float>(world.x - camera.x, world.z - camera.z)
        let ahead = simd_dot(horizontal, heading)
        let side = simd_dot(horizontal, right)
        let height = world.y - floor
        guard (0.30 ... 3.0).contains(ahead), abs(side) <= 0.60,
              (-0.75 ... 2.20).contains(height) else { continue }
        points.append(Int((ahead * 100).rounded()))
        points.append(Int((side * 100).rounded()))
        points.append(Int((height * 100).rounded()))
      }
    }
    return points
  }
}
