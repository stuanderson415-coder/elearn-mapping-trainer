---
name: Word export orientation
description: Landscape page-size behavior in the docx package and how to verify exported files.
---

The `docx` package swaps the supplied width and height when `PageOrientation.LANDSCAPE` is selected.

**Why:** Passing landscape dimensions directly caused the generated Word report to contain portrait dimensions, despite a landscape orientation flag.

**How to apply:** Supply portrait width and height values with the landscape orientation, then inspect the generated `word/document.xml` for landscape orientation and width greater than height.
