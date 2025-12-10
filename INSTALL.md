# Installation Instructions

## Development Setup

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the `zap` folder containing `manifest.json`

## Creating Icons (Optional)

Icons are optional - Chrome will use a default icon if none are provided. If you want custom icons:

1. Open `create-icons.html` in your browser
2. Right-click each canvas and "Save image as":
   - Save as `icon16.png` (16x16)
   - Save as `icon48.png` (48x48)
   - Save as `icon128.png` (128x128)
3. Place the icon files in the root directory
4. Add the icons section back to `manifest.json` if you removed it

## Usage

### Method 1: Keyboard Shortcut
- Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and click on any element to zap it
- The element will fade out and be hidden

### Method 2: Context Menu
- Right-click on any element
- Select "Zap this element" from the context menu

### Persistence
- Zapped elements are saved per URL
- When you reload the page or visit it again, zapped elements remain hidden
- Each website maintains its own list of zapped elements

