import AVFoundation
import AVKit
import Flutter
import UIKit

/// Native iOS Picture-in-Picture for HLS watch / miniplayer (`forge/pip` channel).
/// Uses a tiny in-hierarchy `AVPlayerLayer` so `AVPictureInPictureController` can start.
final class PipManager: NSObject, AVPictureInPictureControllerDelegate {
  static let shared = PipManager()

  private var player: AVPlayer?
  private var playerLayer: AVPlayerLayer?
  private var pipController: AVPictureInPictureController?
  private var hostView: UIView?
  private var autoEnterEnabled = false
  private var pendingUrl: String?
  private var pendingPositionMs: Int64 = 0
  private var resignObserver: NSObjectProtocol?

  private override init() {
    super.init()
    resignObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willResignActiveNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.handleWillResignActive()
    }
  }

  deinit {
    if let resignObserver {
      NotificationCenter.default.removeObserver(resignObserver)
    }
  }

  func isSupported() -> Bool {
    AVPictureInPictureController.isPictureInPictureSupported()
  }

  func setAutoEnter(enabled: Bool, url: String?, positionMs: Int64) {
    autoEnterEnabled = enabled
    pendingUrl = url
    pendingPositionMs = max(0, positionMs)
  }

  @discardableResult
  func enter(url: String, positionMs: Int64) -> Bool {
    guard isSupported(), let mediaUrl = URL(string: url), !url.isEmpty else {
      return false
    }

    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      // Continue — PiP may still work if session was already configured.
    }

    stop(keepAudioSession: true)

    let item = AVPlayerItem(url: mediaUrl)
    let player = AVPlayer(playerItem: item)
    self.player = player

    let seekMs = max(0, positionMs)
    if seekMs > 0 {
      let time = CMTime(value: seekMs, timescale: 1000)
      player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
    }

    guard let root = keyRootView() else {
      stop()
      return false
    }

    let host = UIView(frame: CGRect(x: 0, y: 0, width: 2, height: 2))
    host.isUserInteractionEnabled = false
    host.alpha = 0.01
    root.insertSubview(host, at: 0)
    hostView = host

    let layer = AVPlayerLayer(player: player)
    layer.frame = host.bounds
    layer.videoGravity = .resizeAspect
    host.layer.addSublayer(layer)
    playerLayer = layer

    guard let pip = AVPictureInPictureController(playerLayer: layer) else {
      stop()
      return false
    }
    pip.delegate = self
    if #available(iOS 14.2, *) {
      pip.canStartPictureInPictureAutomaticallyFromInline = true
    }
    pipController = pip

    player.play()
    pendingUrl = url
    pendingPositionMs = seekMs

    // Controller needs a short settle before `isPictureInPicturePossible` flips true.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
      guard let self, let pip = self.pipController else { return }
      if pip.isPictureInPicturePossible {
        pip.startPictureInPicture()
      }
    }
    return true
  }

  func stop(keepAudioSession: Bool = false) {
    if pipController?.isPictureInPictureActive == true {
      pipController?.stopPictureInPicture()
    }
    pipController = nil
    player?.pause()
    player = nil
    playerLayer?.removeFromSuperlayer()
    playerLayer = nil
    hostView?.removeFromSuperview()
    hostView = nil
    if !keepAudioSession {
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  private func handleWillResignActive() {
    guard autoEnterEnabled else { return }
    if pipController?.isPictureInPictureActive == true { return }
    guard let url = pendingUrl, !url.isEmpty else { return }
    _ = enter(url: url, positionMs: pendingPositionMs)
  }

  private func keyRootView() -> UIView? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    for scene in scenes {
      if let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController?.view {
        return root
      }
    }
    return scenes.first?.windows.first?.rootViewController?.view
  }

  // MARK: - AVPictureInPictureControllerDelegate

  func pictureInPictureControllerDidStopPictureInPicture(
    _ pictureInPictureController: AVPictureInPictureController
  ) {
    stop()
  }

  func pictureInPictureController(
    _ pictureInPictureController: AVPictureInPictureController,
    failedToStartPictureInPictureWithError error: Error
  ) {
    stop()
  }
}
