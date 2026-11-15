// macOS 15+ recording helper using Apple's ScreenCaptureKit, including app audio.
// swiftc -parse-as-library scripts/record-window.swift -o .local/record-window
import Foundation
import ScreenCaptureKit
import AVFoundation
import AppKit

final class RecordingDelegate: NSObject, SCRecordingOutputDelegate {
    var finished = false
    func recordingOutputDidStartRecording(_ recordingOutput: SCRecordingOutput) {
        print("Recording started at \(Date().timeIntervalSince1970)")
        fflush(stdout)
    }
    func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) {
        print("Recording failed — \(error.localizedDescription)")
        finished = true
    }
    func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) {
        print("Recording finished")
        finished = true
    }
}

@main
@MainActor
struct Recorder {
    static func main() async {
        _ = NSApplication.shared
        do {
            try await record()
        } catch {
            fputs("Recording failed — \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }

    static func record() async throws {
        let arguments = CommandLine.arguments
        guard arguments.count >= 3 else {
            print("Usage — record-window output.mp4 seconds [window title substring]")
            return
        }
        let match = arguments.count > 3 ? arguments[3] : "NY Delivery"
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let window = content.windows.first(where: { ($0.title ?? "").contains(match) }) else {
            throw NSError(domain: "NYDelivery", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Matching game window is not visible"])
        }
        print("Window — \(window.title ?? match), \(window.frame.width) × \(window.frame.height)")
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let configuration = SCStreamConfiguration()
        configuration.width = 1512
        configuration.height = Int(1512 * window.frame.height / window.frame.width) / 2 * 2
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        configuration.capturesAudio = true
        configuration.captureMicrophone = false
        configuration.excludesCurrentProcessAudio = true
        configuration.showsCursor = true
        let outputConfiguration = SCRecordingOutputConfiguration()
        outputConfiguration.outputURL = URL(fileURLWithPath: arguments[1])
        outputConfiguration.outputFileType = .mp4
        outputConfiguration.videoCodecType = .h264
        let delegate = RecordingDelegate()
        let recording = SCRecordingOutput(configuration: outputConfiguration, delegate: delegate)
        let stream = SCStream(filter: filter, configuration: configuration, delegate: nil)
        try stream.addRecordingOutput(recording)
        try await stream.startCapture()
        let seconds = Double(arguments[2]) ?? 75
        try await Task.sleep(for: .seconds(seconds))
        try await stream.stopCapture()
        for _ in 0..<50 {
            if delegate.finished { break }
            try await Task.sleep(for: .milliseconds(100))
        }
    }
}
