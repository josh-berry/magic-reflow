## 0.3.0 - Handle tab characters gracefully

Added:

- Detect and clean up inconsistent use of tab and space characters, according to
  editor settings.
- Reflow tab characters according to their proper visual width.

## 0.2.0 - Fixes for various list issues

Fixed:

- Lots of corner cases related to lists, through an almost-complete rewrite.

Dropped:

- Support for paragraphs with leading indentation.  The new algorithm
  unfortunately has lots of trouble with these, and they're not widely used.

## 0.1.0 - First Release

Features:

- Wrap within common single-line and multi-line source code comments.
- Wrap bulleted and ordered lists (with or without blank lines between each
  item).  Recognizes numbered and lettered lists of the forms:
  - 1., a., A.
  - (2), (b), (B)
- Wrap paragraphs with leading indentation
- Wrap paragraphs with block indentation
