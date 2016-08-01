# Magic Reflow

Magic Reflow will reflow or rewrap text in a variety of situations, ranging from
paragraphs, to comments, to bulleted and ordered lists (of the variety commonly
seen in Markdown and the like).

## About

It is a replacement for the built-in autoflow package -- it handles many of the
things that autoflow handles, and a lot more:

- Wrap within common single-line and multi-line source code comments.
- Wrap bulleted and ordered lists (with or without blank lines between each
  item).  Recognizes numbered and lettered lists of the forms:
  - 1., a., A.
  - (2), (b), (B)
- Wrap nested lists intelligently.
- Wrap paragraphs with block indentation

...and various combinations of all of the above.

## How to Use Magic Reflow

1. Select the text you want to reflow, or put your cursor in the relevant
   paragraph.
2. Hit Alt-Q.

Note that if you use one of the popular Emacs-emulation packages, you may have
to add the following to your keymap.cson to make the keybinding work:

    'atom-workspace atom-text-editor':
        'alt-q': 'magic-reflow:reflow'

You can also use the "Reflow Selection Magically" context menu option, or the
"Edit > Reflow Selection Magically" menu bar option.

## Future Work

- Support for paragraphs with leading indentation
- Support for tab characters (visual length is hard to compute, sorry :/)
- Support for ASCII-art tables (a la org-mode)
- Ignore code fences (a la Doxygen comments, markdown, etc.)
