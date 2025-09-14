# Icons Directory

This directory contains the extension icons and branding assets for the Console Log Extension.

## Icon Files
- **icon16.png** (16x16 pixels) - Toolbar and menu icon
- **icon32.png** (32x32 pixels) - Extension management page
- **icon48.png** (48x48 pixels) - Extension management page and Chrome Web Store
- **icon128.png** (128x128 pixels) - Chrome Web Store and installation

## Design Concept
The icons feature a console/terminal window design with:
- Dark theme background (#1a1a1a)
- Terminal window representation (#2d2d2d)
- Window controls (red, yellow, green circles)
- Console prompt ($) in green
- Colored log lines representing different log levels:
  - Green: info/success logs
  - Yellow: warning logs
  - Red: error logs
  - Blue: debug logs
  - White: general logs

## Source Files
- **icon.svg** - Vector source file for the icon design
- **create-icons.js** - Documentation and creation guide
- **generate-png-icons.js** - PNG generation script

## Usage
These icons are referenced in the manifest.json file and used throughout the extension interface.