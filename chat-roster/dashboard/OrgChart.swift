// A small always-on-top window with the org chart of the sidebar group you are in: the
// orchestrator dot on top, every chat of the group beneath it, running subagents under their
// chat (gone once they finish). Filled = working. Hover a dot for its title; drag to move.
// A flash runs along the lines whenever a chat messages a worker or a worker reports back.
// Data comes from ../hooks/org.py.
import AppKit

struct Node: Decodable { var key: String? = nil; let title: String; let working: Bool; let agents: [Node]?; var current: Bool? = nil }
struct Event: Decodable { let from: String; let to: String }
struct Org: Decodable { var group: String? = nil; let top: Node?; let chats: [Node]; var events: [Event]? = nil }

let perRow = 5, gap: CGFloat = 32, rowHeight: CGFloat = 44, pad: CGFloat = 16
let topSize: CGFloat = 20, chatSize: CGFloat = 16, agentSize: CGFloat = 9, agentStep: CGFloat = 12
let green = NSColor(red: 0.25, green: 0.73, blue: 0.31, alpha: 1)
let grey = NSColor(white: 0.55, alpha: 1)

func scriptPath() -> String {
  let exe = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
  // OrgChart.app/Contents/MacOS/OrgChart -> dashboard/ -> chat-roster/hooks/org.py
  return exe.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("hooks/org.py").path
}

func loadOrg() -> Data? {
  let p = Process()
  p.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
  p.arguments = ["-I", scriptPath()]
  let out = Pipe()
  p.standardOutput = out
  p.standardError = FileHandle.nullDevice
  do { try p.run() } catch { return nil }
  let data = out.fileHandleForReading.readDataToEndOfFile()
  p.waitUntilExit()
  return p.terminationStatus == 0 ? data : nil
}

// A title label that follows the hovered dot. System tooltips only show for the active app,
// and this window never takes focus, so it draws its own.
final class HoverLabel {
  static let shared = HoverLabel()
  let panel = NSPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
  let field = NSTextField(labelWithString: "")
  init() {
    panel.level = .statusBar
    panel.backgroundColor = NSColor(white: 0.12, alpha: 0.95)
    panel.isOpaque = false
    panel.hasShadow = true
    panel.ignoresMouseEvents = true
    field.textColor = .white
    field.font = .systemFont(ofSize: 11)
    panel.contentView = field
  }
  func show(_ text: String, below rect: NSRect) {
    field.stringValue = text
    field.sizeToFit()
    let size = NSSize(width: field.frame.width + 12, height: field.frame.height + 6)
    field.frame = NSRect(x: 6, y: 3, width: field.frame.width, height: field.frame.height)
    var origin = NSPoint(x: rect.midX - size.width / 2, y: rect.minY - size.height - 4)
    if let screen = NSScreen.main?.visibleFrame { origin.x = min(max(origin.x, screen.minX + 4), screen.maxX - size.width - 4) }
    panel.setFrame(NSRect(origin: origin, size: size), display: true)
    panel.orderFrontRegardless()
  }
  func hide() { panel.orderOut(nil) }
}

final class Dot: NSView {
  let working: Bool, isCurrent: Bool, title: String
  init(frame: NSRect, working: Bool, title: String, isCurrent: Bool = false) {
    self.working = working
    self.isCurrent = isCurrent
    self.title = title
    super.init(frame: frame)
    addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self))
  }
  required init?(coder: NSCoder) { fatalError() }
  override func mouseEntered(with event: NSEvent) {
    guard let window else { return }
    HoverLabel.shared.show(title, below: window.convertToScreen(convert(bounds, to: nil)))
  }
  override func mouseExited(with event: NSEvent) { HoverLabel.shared.hide() }
  override func draw(_ dirtyRect: NSRect) {
    let path = NSBezierPath(ovalIn: bounds.insetBy(dx: 1, dy: 1))
    path.lineWidth = isCurrent ? 2.5 : 1.5
    if working { green.setFill(); path.fill() }
    (working ? green : isCurrent ? NSColor.white : grey).setStroke()
    path.stroke()
  }
}

// Everything is centered on one vertical axis: the orchestrator on top with its subagents
// flanking it, then the chats in centered rows of up to five, each with its subagents below.
final class Chart: NSView {
  var org = Org(top: nil, chats: [])
  var centers: [String: NSPoint] = [:]  // node key -> dot center, for the flashes
  var parents: [String: String] = [:]   // agent key -> the chat it belongs to
  override var isFlipped: Bool { true }
  override var mouseDownCanMoveWindow: Bool { true }

  var rows: [[Node]] { stride(from: 0, to: org.chats.count, by: perRow).map { Array(org.chats[$0..<min($0 + perRow, org.chats.count)]) } }
  var agentRows: Int { org.chats.map { $0.agents?.count ?? 0 }.max() ?? 0 }
  var rowStep: CGFloat { rowHeight + CGFloat(agentRows) * agentStep }
  var topAgents: Int { min(10, org.top?.agents?.count ?? 0) }
  var topKey: String { org.top?.key ?? "group" }
  var topCenter: NSPoint { NSPoint(x: size().width / 2, y: pad + topSize / 2) }

  func size() -> NSSize {
    let widest = CGFloat(rows.map(\.count).max() ?? 1) * gap
    let flank = 2 * (topSize / 2 + 8 + CGFloat((topAgents + 1) / 2) * agentStep) + 8
    return NSSize(width: max(widest, flank, 90) + 2 * pad, height: 2 * pad + topSize + CGFloat(rows.count) * rowStep)
  }

  // x of chat i in a row of n, centered on the window.
  func x(_ i: Int, of n: Int) -> CGFloat { size().width / 2 + (CGFloat(i) - CGFloat(n - 1) / 2) * gap }
  func barY(_ r: Int) -> CGFloat { pad + topSize + CGFloat(r) * rowStep + rowHeight * 0.25 }
  func chatY(_ r: Int) -> CGFloat { barY(r) + rowHeight * 0.45 }

  func place(_ size: CGFloat, at c: NSPoint, _ node: Node, title: String) {
    addSubview(Dot(frame: NSRect(x: c.x - size / 2, y: c.y - size / 2, width: size, height: size), working: node.working, title: title, isCurrent: node.current ?? false))
    if let key = node.key { centers[key] = c }
  }

  func rebuild() {
    subviews.forEach { $0.removeFromSuperview() }
    centers = [:]
    parents = [:]
    let top = org.top ?? Node(title: "Orchestrator", working: false, agents: [])
    let group = org.group.map { " · \($0)" } ?? ""
    place(topSize, at: topCenter, top, title: "\(top.title) (orchestrator\(group))")
    centers[topKey] = topCenter
    // The orchestrator's own subagents flank its dot, alternating right and left (up to 10).
    for (j, a) in (top.agents ?? []).prefix(10).enumerated() {
      let offset = topSize / 2 + 8 + CGFloat(j / 2) * agentStep + agentSize / 2
      let c = NSPoint(x: topCenter.x + (j % 2 == 0 ? offset : -offset), y: topCenter.y)
      place(agentSize, at: c, a, title: "\(a.title) (subagent of \(top.title))")
      if let k = a.key { parents[k] = topKey }
    }
    for (r, row) in rows.enumerated() {
      for (i, chat) in row.enumerated() {
        let c = NSPoint(x: x(i, of: row.count), y: chatY(r))
        place(chatSize, at: c, chat, title: chat.title)
        for (j, a) in (chat.agents ?? []).enumerated() {
          place(agentSize, at: NSPoint(x: c.x, y: c.y + chatSize / 2 + 6 + CGFloat(j) * agentStep), a, title: "\(a.title) (subagent of \(chat.title))")
          if let k = a.key, let ck = chat.key { parents[k] = ck }
        }
      }
    }
    needsDisplay = true
  }

  // The route along the drawn lines from a dot up to the orchestrator.
  func routeToTop(_ key: String) -> [NSPoint]? {
    guard let c = centers[key] else { return nil }
    if key == topKey { return [c] }
    if let parent = parents[key], let pc = centers[parent] {
      return [c] + (parent == topKey ? [pc] : (routeToTop(parent) ?? [pc]))
    }
    guard abs(c.y - topCenter.y) > 1 else { return [c, topCenter] }
    let bar = c.y - rowHeight * 0.45
    return [c, NSPoint(x: c.x, y: bar), NSPoint(x: topCenter.x, y: bar), topCenter]
  }

  // Where a subagent dot sits (or sat) beside its chat: the start of a hand-back from a
  // subagent that has already finished, and the end of a spawn.
  func agentSpot(of parent: String) -> NSPoint? {
    guard let c = centers[parent] else { return nil }
    return parent == topKey ? NSPoint(x: c.x + topSize / 2 + 14, y: c.y) : NSPoint(x: c.x, y: c.y + chatSize / 2 + 10)
  }

  func flash(_ e: Event) {
    var points: [NSPoint]
    if e.to == "spawn" {
      guard let c = centers[e.from], let spot = agentSpot(of: e.from) else { return }
      points = [c, spot]
    } else if centers[e.from] == nil, e.from.hasPrefix("agent:") {
      guard let c = centers[e.to], let spot = agentSpot(of: e.to) else { return }
      points = [spot, c]
    } else {
      guard let up = routeToTop(e.from), let down = routeToTop(e.to) else { return }
      points = up + down.reversed()
      // Drop the shared tail so a flash between relatives does not detour through the top.
      while points.count > 2, let i = points.indices.dropLast().first(where: { points[$0] == points[$0 + 1] }) { points.remove(at: i) }
    }
    if points.count < 2 || points.first == points.last { pulse(at: points.first ?? topCenter); return }
    travel(points)
  }

  func layerPoint(_ p: NSPoint) -> CGPoint {
    let flippedLayer = layer?.contentsAreFlipped() ?? true
    return CGPoint(x: p.x, y: flippedLayer ? p.y : bounds.height - p.y)
  }

  func spark() -> CALayer {
    let dot = CALayer()
    dot.bounds = CGRect(x: 0, y: 0, width: 7, height: 7)
    dot.cornerRadius = 3.5
    dot.backgroundColor = NSColor.white.cgColor
    dot.shadowColor = green.cgColor
    dot.shadowOpacity = 1
    dot.shadowRadius = 4
    dot.shadowOffset = .zero
    return dot
  }

  // A bright stretch of line runs along the route, with a spark at its head, like the
  // message itself moving through the wire.
  func travel(_ points: [NSPoint]) {
    guard let host = layer else { return }
    let path = CGMutablePath()
    path.move(to: layerPoint(points[0]))
    points.dropFirst().forEach { path.addLine(to: layerPoint($0)) }
    let duration = 0.9

    let glow = CAShapeLayer()
    glow.path = path
    glow.fillColor = nil
    glow.strokeColor = green.cgColor
    glow.lineWidth = 2.5
    glow.lineCap = .round
    glow.shadowColor = green.cgColor
    glow.shadowOpacity = 0.9
    glow.shadowRadius = 3
    glow.shadowOffset = .zero
    glow.strokeStart = 1
    glow.strokeEnd = 1
    host.addSublayer(glow)
    let head = CABasicAnimation(keyPath: "strokeEnd")
    head.fromValue = 0
    head.toValue = 1
    let tail = CAKeyframeAnimation(keyPath: "strokeStart")
    tail.values = [0, 0, 1]
    tail.keyTimes = [0, 0.3, 1]
    let segment = CAAnimationGroup()
    segment.animations = [head, tail]
    segment.duration = duration

    let dot = spark()
    dot.position = layerPoint(points.last!)
    dot.opacity = 0
    host.addSublayer(dot)
    let move = CAKeyframeAnimation(keyPath: "position")
    move.path = path
    move.calculationMode = .paced
    let show = CAKeyframeAnimation(keyPath: "opacity")
    show.values = [1, 1, 0]
    show.keyTimes = [0, 0.85, 1]
    let spark = CAAnimationGroup()
    spark.animations = [move, show]
    spark.duration = duration

    CATransaction.begin()
    CATransaction.setCompletionBlock {
      glow.removeFromSuperlayer()
      dot.removeFromSuperlayer()
    }
    glow.add(segment, forKey: "travel")
    dot.add(spark, forKey: "travel")
    CATransaction.commit()
  }

  func pulse(at p: NSPoint) {
    guard let host = layer else { return }
    let ring = CAShapeLayer()
    ring.path = CGPath(ellipseIn: CGRect(x: -10, y: -10, width: 20, height: 20), transform: nil)
    ring.fillColor = nil
    ring.strokeColor = green.cgColor
    ring.lineWidth = 1.5
    ring.position = layerPoint(p)
    host.addSublayer(ring)
    let grow = CABasicAnimation(keyPath: "transform.scale")
    grow.fromValue = 0.6
    grow.toValue = 1.6
    let fade = CABasicAnimation(keyPath: "opacity")
    fade.fromValue = 1
    fade.toValue = 0
    let both = CAAnimationGroup()
    both.animations = [grow, fade]
    both.duration = 0.8
    ring.opacity = 0
    CATransaction.begin()
    CATransaction.setCompletionBlock { ring.removeFromSuperlayer() }
    ring.add(both, forKey: "pulse")
    CATransaction.commit()
  }

  override func draw(_ dirtyRect: NSRect) {
    guard !rows.isEmpty else { return }
    let mid = size().width / 2
    grey.withAlphaComponent(0.6).setStroke()
    let lines = NSBezierPath()
    lines.lineWidth = 1
    lines.move(to: NSPoint(x: mid, y: topCenter.y + topSize / 2))
    lines.line(to: NSPoint(x: mid, y: barY(rows.count - 1)))
    for (r, row) in rows.enumerated() {
      let y = barY(r)
      lines.move(to: NSPoint(x: min(x(0, of: row.count), mid), y: y))
      lines.line(to: NSPoint(x: max(x(row.count - 1, of: row.count), mid), y: y))
      for i in 0..<row.count {
        lines.move(to: NSPoint(x: x(i, of: row.count), y: y))
        lines.line(to: NSPoint(x: x(i, of: row.count), y: chatY(r) - chatSize / 2))
      }
    }
    lines.stroke()
  }
}

final class App: NSObject, NSApplicationDelegate {
  var panel: NSPanel!
  let chart = Chart()
  var lastData: Data?

  func applicationDidFinishLaunching(_ n: Notification) {
    panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 130, height: 40), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    panel.level = .floating
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
    panel.isMovableByWindowBackground = true
    panel.backgroundColor = .clear
    panel.isOpaque = false
    panel.hasShadow = true
    panel.setFrameAutosaveName("SolveLabOrgChart")

    // A solid dark card: readable over any wallpaper or window.
    let card = NSView()
    card.wantsLayer = true
    card.layer?.backgroundColor = NSColor(white: 0.11, alpha: 0.94).cgColor
    card.layer?.cornerRadius = 10
    card.layer?.borderWidth = 0.5
    card.layer?.borderColor = NSColor(white: 1, alpha: 0.12).cgColor
    chart.wantsLayer = true
    card.addSubview(chart)
    panel.contentView = card

    refresh()
    if !panel.setFrameUsingName("SolveLabOrgChart"), let screen = NSScreen.main {
      let f = screen.visibleFrame, s = panel.frame.size
      panel.setFrameOrigin(NSPoint(x: f.maxX - s.width - 16, y: f.maxY - s.height - 16))
    }
    updateVisibility()
    NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] _ in self?.updateVisibility() }
    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      self?.updateVisibility()
      self?.refresh()
    }
  }

  // Keep the window on a screen: after a display change (a different monitor or resolution)
  // a remembered spot can be off every screen, so it moves back to the main screen's corner.
  func keepOnScreen() {
    let f = panel.frame
    if NSScreen.screens.contains(where: { $0.visibleFrame.contains(f) }) { return }
    guard let screen = NSScreen.main?.visibleFrame else { return }
    panel.setFrameOrigin(NSPoint(x: screen.maxX - f.width - 16, y: screen.maxY - f.height - 16))
  }

  // Shown only while the Claude app is the frontmost app.
  func updateVisibility() {
    keepOnScreen()
    let isClaude = NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.anthropic.claudefordesktop"
    if isClaude, !panel.isVisible { panel.orderFrontRegardless() }
    if !isClaude, panel.isVisible { panel.orderOut(nil); HoverLabel.shared.hide() }
  }

  var isLoading = false
  func refresh() {
    guard !isLoading else { return }
    isLoading = true
    DispatchQueue.global().async {
      // Redraw only when something changed, so a hovered label is not cleared every refresh.
      let data = loadOrg()
      DispatchQueue.main.async {
        self.isLoading = false
        guard let data, data != self.lastData, let org = try? JSONDecoder().decode(Org.self, from: data) else { return }
        self.lastData = data
        HoverLabel.shared.hide()
        self.chart.org = org
        let s = self.chart.size()
        // Grow and shrink around the top edge's center so the chart stays where it was.
        let old = self.panel.frame
        self.panel.setFrame(NSRect(x: old.midX - s.width / 2, y: old.maxY - s.height, width: s.width, height: s.height), display: true)
        self.keepOnScreen()
        self.chart.frame = NSRect(origin: .zero, size: s)
        self.chart.rebuild()
        // Messages that arrived in the same second flash one after another, a third of a second apart.
        if self.panel.isVisible {
          for (i, e) in (org.events ?? []).prefix(12).enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.33) { self.chart.flash(e) }
          }
        }
      }
    }
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = App()
app.delegate = delegate
app.run()
