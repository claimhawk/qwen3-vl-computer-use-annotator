# Qwen3-VL Computer Use Annotator

A visual annotation tool for creating training data for Vision-Language Models (VLMs) to perform computer use tasks. Designed for fine-tuning models like Qwen3-VL for UI grounding and interaction.

## Features

- **Element Annotation**: Draw bounding boxes for UI elements (buttons, text inputs, dropdowns, grids, icons, panels, etc.)
- **Task Definition**: Create tasks with prompts and target elements
- **Prior States**: Define element states (filled, selected, checked, open, visible) for training data variation
- **Grid Mode**: Quickly annotate grids, icon arrays, and list boxes
- **Masking**: Mask dynamic content regions for template generation
- **Color Sampling**: Sample background colors from the image for accurate masking
- **Icon Export**: Export icon grids as individual cropped images
- **Panel Visibility**: Control which panels are visible per task for loading screens/dialogs
- **Zoom/Pan**: Navigate large screenshots easily

## Element Types

- Button, Text Input, Label
- Dropdown, List Box, Checkbox, Radio
- Grid, Icon
- Panel, Dialog, Toolbar, Menu Bar, Tab
- Scrollbar, Title Bar
- Text (maskable text regions)

## Export Format

Exports a ZIP containing:
- `annotation.json` - Element definitions, tasks, and metadata
- `original.png` - Original screenshot
- `masked.png` - Screenshot with dynamic regions masked
- `annotated.png` - Screenshot with bounding box overlays
- `icons/` - Cropped icon images (when "Export to ZIP" is enabled)

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and drag an image or ZIP to start annotating.

## Usage

1. **Load Image**: Drag & drop a screenshot or previously exported ZIP
2. **Select Element Type**: Choose the type of UI element to annotate
3. **Draw Bounding Boxes**: Click and drag on the image to create elements
4. **Configure Elements**: Set labels, mask colors, rows/cols for grids
5. **Create Tasks**: Define interaction tasks with prompts and target elements
6. **Set Prior States**: Configure element states and panel visibility per task
7. **Export**: Download ZIP with all annotation data and images

## Keyboard/Mouse

- Click & drag: Draw new element
- Shift + click & drag: Draw over existing elements
- Click element: Select
- Shift + click: Multi-select range (for bulk delete)
- Drag edges: Resize element

## License

MIT
