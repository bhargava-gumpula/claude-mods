#!/bin/sh
# Builds OrgChart.app next to this script (a menu-bar-less, Dock-less floating window).
set -e
cd "$(dirname "$0")"
mkdir -p OrgChart.app/Contents/MacOS
swiftc -O -o OrgChart.app/Contents/MacOS/OrgChart OrgChart.swift
cat > OrgChart.app/Contents/Info.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>local.claude-mods.orgchart</string>
<key>CFBundleName</key><string>OrgChart</string>
<key>CFBundleExecutable</key><string>OrgChart</string>
<key>LSUIElement</key><true/>
</dict></plist>
PLIST
codesign --force -s - OrgChart.app >/dev/null 2>&1 || true
