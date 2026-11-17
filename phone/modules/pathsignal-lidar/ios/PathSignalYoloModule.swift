import ExpoModulesCore
import Foundation
import onnxruntime_objc

public final class PathSignalYoloModule: Module {
  private let queue = DispatchQueue(label: "pathsignal.yolox")
  private var environment: ORTEnv?
  private var session: ORTSession?
  private var loadedPath: String?

  public func definition() -> ModuleDefinition {
    Name("PathSignalYolo")
    AsyncFunction("run") { (modelURI: String, input: String, promise: Promise) in
      self.queue.async {
        do {
          promise.resolve(try self.run(modelURI: modelURI, input: input))
        } catch {
          promise.reject(error)
        }
      }
    }
  }

  private func run(modelURI: String, input: String) throws -> String {
    let width = 640
    guard let bytes = Data(base64Encoded: input), bytes.count == 3 * width * width * MemoryLayout<Float>.size else {
      throw NSError(domain: "PathSignalYolo", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid model input size."])
    }
    guard let url = URL(string: modelURI), url.isFileURL else {
      throw NSError(domain: "PathSignalYolo", code: 2, userInfo: [NSLocalizedDescriptionKey: "Model file is unavailable."])
    }
    let runtime: ORTSession
    if let session, loadedPath == url.path {
      runtime = session
    } else {
      let env = try ORTEnv(loggingLevel: .warning)
      runtime = try ORTSession(env: env, modelPath: url.path, sessionOptions: nil)
      session = runtime
      environment = env
      loadedPath = url.path
    }
    let value = try ORTValue(tensorData: NSMutableData(data: bytes), elementType: .float, shape: [1, 3, 640, 640])
    guard let inputName = try runtime.inputNames().first,
          let outputName = try runtime.outputNames().first,
          let result = try runtime.run(withInputs: [inputName: value], outputNames: [outputName], runOptions: nil)[outputName] else {
      throw NSError(domain: "PathSignalYolo", code: 3, userInfo: [NSLocalizedDescriptionKey: "Model output is unavailable."])
    }
    return try (result.tensorData() as Data).base64EncodedString()
  }
}
