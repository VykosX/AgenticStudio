---
name: vision-inspection-workflow
description: Read screenshots, OCR text, recognize image content, and inspect video-derived frames with the LM Studio multimodal model instead of relying on markdown embeds alone.
---

# Vision Inspection Workflow

## When To Use

- User wants text read from a screenshot, photo, scan, UI, chart, or other local image.
- User wants image recognition, visual question answering, or captioning on a local file.
- User wants to inspect video content and the workflow can be reduced to representative frames.
- An image was embedded into chat for display, but the model still needs actual pixel analysis.

## Workflow

1. If the target is on screen, capture it first with `as_screenshot_capture` or locate the existing image file.
2. If the goal is exact text, numbers, equations, or UI readouts, call `as_vision_ocr` on the image source with a precise request about what to decode.
3. Start with the default fast path on the vision tools. Only retry with `fast=false` if the fast answer is incomplete, clearly wrong, or too uncertain for the task.
4. If the goal is to click, drag, crop, or otherwise act on a specific button, slider, icon, or label, call `as_vision_target` to get approximate image-relative coordinates and bounds for the requested targets.
5. If the goal is a detailed question about inner elements, interface state, or a specific region, call `as_vision_focus` with a concrete question.
6. If the goal is broader recognition or interpretation, call `as_vision_recognize` with a concrete question and expected output.
7. If the image is hard to read, use a tighter crop, a higher-resolution source, or another screenshot before retrying. Prefer a better crop before escalating from `fast=true` to `fast=false` when the problem is local readability.
8. If the target is a video, inspect it with `as_media_probe`, then use `as_media_transform` to extract representative frames and run the vision tools on those frames.
9. Use `as_file_embed` only when you want the image rendered in the transcript for the user; do not rely on the embed itself as proof the model has seen the pixels.
10. Report uncertainty when text is tiny, rotated, low-contrast, or partially obscured.

## Preferred Tools

- `as_screenshot_capture`
- `as_vision_ocr`
- `as_vision_target`
- `as_vision_focus`
- `as_vision_recognize`
- `as_media_probe`
- `as_media_transform`
- `as_image_identify`
- `as_file_embed`

## Output

- source image or frame paths
- OCR text or recognition answer
- uncertainty notes
- follow-up frame or crop suggestions when needed
