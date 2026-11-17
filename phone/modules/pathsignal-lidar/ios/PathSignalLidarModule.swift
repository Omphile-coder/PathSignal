import ARKit
import CoreVideo
import ExpoModulesCore
import SceneKit
import UIKit
import simd

struct LidarRequest: Record {
  @Field var id: Int = 0
  @Field var mode: String = "distance"
}

private enum ScanMode: String {
  case distance, floor, corridor
}

public final class PathSignalLidarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PathSignalLidar")

    Function("isSupported") {
      ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    }

    View(PathSignalLidarView.self) {
      Events("onReading")
      Prop("request") { (view: PathSignalLidarView, request: LidarRequest) in
        view.requestReading(request)
      }
    }
  }
}

final class PathSignalLidarView: ExpoView, ARSessionDelegate {
  let onReading = EventDispatcher()
  private let preview = ARSCNView(frame: .zero)
  private var requestedId: Int?
  private var latestId = 0
  private var mode = ScanMode.distance
  private var floor: Float?
  private var corridorFrames: [[Int]] = []
  private var corridorPose: simd_float4x4?
  private var samples: [Float] = []
  private var timeout: DispatchWorkItem?
  private var lastFrameTime: TimeInterval = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    preview.isAccessibilityElement = false
    preview.accessibilityElementsHidden = true
    preview.session.delegate = self
    preview.session.delegateQueue = .main
    addSubview(preview)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    preview.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else {
      cancelReading()
      floor = nil
      preview.session.pause()
      return
    }
    guard ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else { return }
    let configuration = ARWorldTrackingConfiguration()
    configuration.worldAlignment = .gravity
    configuration.planeDetection = [.horizontal]
    configuration.frameSemantics.insert(.sceneDepth)
    preview.session.run(configuration)
  }

  func requestReading(_ request: LidarRequest) {
    let id = request.id
    guard id > 0, id != latestId, let mode = ScanMode(rawValue: request.mode) else { return }
    self.mode = mode
    latestId = id
    cancelReading()
    requestedId = id
    if mode == .floor { floor = nil }
    if mode == .corridor && floor == nil {
      finish(error: "Set a floor reference first.")
      return
    }
    guard ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
      finish(error: "Scene depth is unavailable on this device.")
      return
    }

    let deadline = DispatchWorkItem { [weak self] in
      guard let self, self.requestedId == id else { return }
      switch self.mode {
      case .distance: self.finish(error: "No stable LiDAR reading. Hold still and aim at a broad, solid surface.")
      case .floor: self.finish(error: "Floor reference unavailable. Aim the ring at a clear patch of floor.")
      case .corridor: self.finish(error: "Not enough stable depth in the corridor. Hold still and aim farther ahead.")
      }
    }
    timeout = deadline
    DispatchQueue.main.asyncAfter(deadline: .now() + 6, execute: deadline)
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard let id = requestedId, case .normal = frame.camera.trackingState,
          frame.timestamp - lastFrameTime >= (mode == .corridor ? 0.15 : 0.09), let depth = frame.sceneDepth else { return }
    lastFrameTime = frame.timestamp
    if mode == .floor {
      setFloor(id: id, frame: frame, depth: depth)
      return
    }
    if mode == .corridor {
      scanCorridor(id: id, frame: frame, depth: depth)
      return
    }
    guard let sample = centreDepth(depth) else {
      samples.removeAll(keepingCapacity: true)
      return
    }
    samples.append(sample)
    guard samples.count == 3 else { return }

    let sorted = samples.sorted()
    let median = sorted[1]
    guard sorted[2] - sorted[0] <= max(0.10, median * 0.10) else {
      samples.removeFirst()
      return
    }
    cancelReading()
    onReading(["id": id, "metres": Double(median)])
  }

  private func setFloor(id: Int, frame: ARFrame, depth: ARDepthData) {
    let centre = CGPoint(x: preview.bounds.midX, y: preview.bounds.midY)
    guard let measured = centreDepth(depth),
          let query = preview.raycastQuery(from: centre, allowing: .existingPlaneGeometry, alignment: .horizontal),
          let hit = preview.session.raycast(query).first else { return }
    let point = hit.worldTransform.columns.3
    let cameraPoint = simd_inverse(frame.camera.transform) * point
    let height = frame.camera.transform.columns.3.y - point.y
    guard (0.45 ... 2.2).contains(height),
          abs(-cameraPoint.z - measured) <= max(0.15, measured * 0.12) else { return }
    floor = point.y
    cancelReading()
    onReading(["id": id, "floorSet": true])
  }

  private func scanCorridor(id: Int, frame: ARFrame, depth: ARDepthData) {
    guard let floor else {
      finish(error: "Set a floor reference first.")
      return
    }
    let pose = frame.camera.transform
    if let origin = corridorPose,
       simd_distance(origin.columns.3, pose.columns.3) > 0.08 ||
       simd_dot(origin.columns.2, pose.columns.2) < 0.99 {
      corridorFrames.removeAll(keepingCapacity: true)
      corridorPose = nil
    }
    guard let points = LidarCorridor.sample(frame: frame, depth: depth, floor: floor) else {
      corridorFrames.removeAll(keepingCapacity: true)
      corridorPose = nil
      return
    }
    if corridorPose == nil { corridorPose = pose }
    corridorFrames.append(points)
    guard corridorFrames.count == 3 else { return }
    let frames = corridorFrames
    cancelReading()
    onReading(["id": id, "frames": frames])
  }

  private func invalidateFloor() {
    floor = nil
    onReading(["id": 0, "floorInvalidated": true])
  }

  func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
    if case .limited(.relocalizing) = camera.trackingState {
      invalidateFloor()
      finish(error: "Camera tracking changed. Set the floor reference again.")
    }
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    invalidateFloor()
    finish(error: "The LiDAR camera stopped. Close the preview and reopen it.")
  }

  func sessionWasInterrupted(_ session: ARSession) {
    invalidateFloor()
    finish(error: "The LiDAR camera was interrupted. Try again when the preview returns.")
  }

  private func cancelReading() {
    timeout?.cancel()
    timeout = nil
    requestedId = nil
    corridorPose = nil
    corridorFrames.removeAll(keepingCapacity: true)
    samples.removeAll(keepingCapacity: true)
    lastFrameTime = 0
  }

  private func finish(error: String) {
    guard let id = requestedId else { return }
    cancelReading()
    onReading(["id": id, "error": error])
  }

  private func centreDepth(_ data: ARDepthData) -> Float? {
    let depth = data.depthMap
    guard let confidence = data.confidenceMap,
          CVPixelBufferGetPixelFormatType(depth) == kCVPixelFormatType_DepthFloat32,
          CVPixelBufferGetPixelFormatType(confidence) == kCVPixelFormatType_OneComponent8
    else { return nil }
    let width = CVPixelBufferGetWidth(depth)
    let height = CVPixelBufferGetHeight(depth)
    guard width >= 5, height >= 5, CVPixelBufferGetWidth(confidence) == width,
          CVPixelBufferGetHeight(confidence) == height else { return nil }

    guard CVPixelBufferLockBaseAddress(depth, .readOnly) == kCVReturnSuccess else { return nil }
    defer { CVPixelBufferUnlockBaseAddress(depth, .readOnly) }
    guard CVPixelBufferLockBaseAddress(confidence, .readOnly) == kCVReturnSuccess else { return nil }
    defer { CVPixelBufferUnlockBaseAddress(confidence, .readOnly) }
    guard let depths = CVPixelBufferGetBaseAddress(depth),
          let confidences = CVPixelBufferGetBaseAddress(confidence) else { return nil }

    let depthStride = CVPixelBufferGetBytesPerRow(depth)
    let confidenceStride = CVPixelBufferGetBytesPerRow(confidence)
    var values: [Float] = []
    for y in (height / 2 - 2)...(height / 2 + 2) {
      let depthRow = depths.advanced(by: y * depthStride).assumingMemoryBound(to: Float.self)
      let confidenceRow = confidences.advanced(by: y * confidenceStride).assumingMemoryBound(to: UInt8.self)
      for x in (width / 2 - 2)...(width / 2 + 2) {
        let value = depthRow[x]
        if Int(confidenceRow[x]) >= ARConfidenceLevel.medium.rawValue,
           value.isFinite, value > 0 {
          values.append(value)
        }
      }
    }

    guard values.count >= 12 else { return nil }
    values.sort()
    let median = values[values.count / 2]
    let spread = values[values.count * 4 / 5] - values[values.count / 5]
    return spread <= max(0.12, median * 0.12) ? median : nil
  }
}
