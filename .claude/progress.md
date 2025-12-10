# Annotator Project Progress

| Date | Feature | Work |
|------|---------|------|
| 2025-11-27 | Core Foundation | Initial commit: VLM Computer Use Annotation Tool - Base Next.js app for annotating screenshots with bounding boxes and tasks |
| 2025-11-28 | Action System | Add comprehensive action types for computer use tasks - TaskAction types (left_click, double_click, type, scroll, key, wait, terminate, answer) |
| 2025-11-28 | Action System | Add required arguments for each action type - Fields like text, keys, pixels, coordinates, waitTime per action |
| 2025-12-01 | Documentation | Add contributing section to README |
| 2025-12-01 | Canvas UI | Enhance annotation canvas with improved UI and functionality - Drawing, selection, element manipulation |
| 2025-12-01 | Licensing | Update license to Tylt proprietary (research use only) |
| 2025-12-02 | Training Data | Add toleranceX/toleranceY fields for training data - Computed 70% tolerance bounds for click targets |
| 2025-12-02 | Documentation | Add screenshots and fix space key in text inputs |
| 2025-12-02 | Documentation | Add agents.md with commit guidelines and CLAUDE.md symlink |
| 2025-12-05 | CUDAG Integration | Major refactor with OCR integration and CUDAG generator support - Chandra OCR API, export to CUDAG-compatible ZIP format, masked/annotated images |
| 2025-12-05 | CUDAG Integration | Remove GenerateButton, use cudag CLI with ZIP instead - Simplified workflow |
| 2025-12-06 | Grid Selection | Add grid cell selection, preserve row/col positions on resize - selectableRow, selectableCell flags, grid task generation, custom row/col sizing |
| 2025-12-07 | Data Types | Add Data Types Extractor and dropdown task generation - DataTypeDefinition interface for structured data, dropdown open/select task templates |
| 2025-12-08 | Text Input Tasks | Add text input task template with click_type action - Single task generates 2 tool calls (click + type), kebab-case taskTypes, grid prior states |

---

## AI-Assisted Development

Built by 1 developer + AI (Claude Code). 14 commits in 12 days.

### Cost Comparison

- **Traditional:** 1 frontend developer @ $150k/yr for 3-4 weeks = **$9-12k**
- **Actual:** 1 developer + AI, 12 days = **$1-2k**
- **Savings: ~85%**

Full annotation tool with OCR integration, CUDAG export, and task generation.
