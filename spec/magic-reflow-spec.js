'use babel';

import MagicReflow from '../lib/magic-reflow';

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g.
// `fit` or `fdescribe`).  Remove the `f` to unfocus the block.

function test([input, line_len, tab_vlen], expected) {
    console.log(`BEGIN TEST:\n${input}`);
    let actual = MagicReflow.reflow(
        input, {line_len: line_len, tab_vlen: tab_vlen});
    console.log(`TEST EXPECTED:\n${expected}`);
    console.log(`TEST ACTUAL:\n${[actual]}`);
    expect(actual).toBe(expected);
};

describe('MagicReflow', () => {
    describe('when reflowing a single paragraph', () => {
        it('leaves short lines alone', () => test(
            ['This is a short line.'],
            'This is a short line.'
        ));

        it('wraps long lines', () => test(
            ['This is a much longer line, with more text.', 30],
            'This is a much longer line,\nwith more text.'
        ));

        it('leaves leading whitespace intact', () => test(
            ['\nLeading whitespace.', 80],
            '\nLeading whitespace.'
        ));

        it('leaves more leading whitespace intact', () => test(
            ['\n\nLeading whitespace.', 80],
            '\n\nLeading whitespace.'
        ));

        it('leaves trailing whitespace intact', () => test(
            ['Trailing whitespace.\n', 80],
            'Trailing whitespace.\n'
        ));

        it('leaves more trailing whitespace intact', () => test(
            ['Trailing whitespace.\n\n', 80],
            'Trailing whitespace.\n\n'
        ));

        it('lets long words overflow', () => test(
            ['This IsAReallyLongWordThatDoesntFit in a single line.', 20],
            'This\nIsAReallyLongWordThatDoesntFit\nin a single line.'
        ));

        it('re-wraps multiple short lines', () => test(
            ['This is a bunch\nof short lines,\nwith some text.', 30],
            'This is a bunch of short\nlines, with some text.'
        ));

        it('re-wraps multiple long lines', () => test(
            ['This is a long line, followed by another long\nline.  This is another long line.', 30],
            'This is a long line, followed\nby another long line.  This is\nanother long line.'
        ));

        it('puts two spaces after a period at the end of a line', () => test(
            ['This is a long line, followed by another long line.\nThis is another long line.', 30],
            'This is a long line, followed\nby another long line.  This is\nanother long line.'
        ));

        it('leaves leading and trailing blank lines alone', () => test(
            ['This is a short line with some words.', 12],
            'This is a\nshort line\nwith some\nwords.'
        ));
    });

    describe('when reflowing multiple paragraphs', () => {
        it('wraps each paragraph independently', () => test(
            ['First paragraph is this.\n\nSecond paragraph is this.', 16],
            'First paragraph\nis this.\n\nSecond paragraph\nis this.'
        ));
        it('leaves leading and trailing blank lines alone', () => test(
            ['\n\nThis is a short line.\n\nAnother paragraph.\n\n', 12],
            '\n\nThis is a\nshort line.\n\nAnother\nparagraph.\n\n'
        ));
        it('re-wraps short lines within a paragraph', () => test(
            ['First\nparagraph is this.\n\nSecond\nparagraph is this.', 16],
            'First paragraph\nis this.\n\nSecond paragraph\nis this.'
        ));
    });

    // XXX not implemented in the new version
    xdescribe('when dealing with leading space characters', () => {
        it('wraps a single line in block style', () => test(
            ['   This line should be wrapped in block style.', 12],
            '   This line\n   should be\n   wrapped\n   in block\n   style.'
        ));

        it('recognizes differing first-line indentation', () => test(
            ['  This is the first line.\nThis is the second line.', 12],
            '  This is\nthe first\nline.  This\nis the\nsecond line.'
        ));

        it('recognizes block-style indentation', () => test(
            ['  This is the first line.\n  This is the second line.', 14],
            '  This is the\n  first line.\n  This is the\n  second line.'
        ));

        it('recognizes combined first-line and block-style indentation', () => test(
            ['    This is the first line.\n  This is the second line.', 14],
            '    This is\n  the first\n  line.  This\n  is the\n  second line.'
        ));

        it('fixes inconsistent indentation', () => test(
            [`
    This is the first line.
  This is the second line.
   This is the third line.
`, 14],
            `
    This is
  the first
  line.  This
  is the
  second line.
  This is the
  third line.
`
        ));
    });

    // XXX Need to implement visual-width calculations to handle tabs... :/
    xdescribe('when dealing with leading tab characters', () => {
        it('preserves leading indents with tabs (one line)', () => test(
            ['\tLeading tab.\nSecond line.', 40],
            '\tLeading tab.  Second line.'
        ));
        it('preserves block style with tabs (one line)', () => test(
            ['\tLeading tab.\n\tSecond line.', 40],
            '\tLeading tab.  Second line.'
        ));
        it('preserves leading indents with tabs (multi-line)', () => test(
            ['\tLeading tab.\nSecond line.', 40],
            '\tLeading tab.  Second line.'
        ));
        it('preserves block style with tabs (multi-line)', () => test(
            ['\tLeading tab that is a long line.\n\tSecond line.', 24, 8],
            '\tLeading tab that\n\tis a long line.\n\tSecond line.'
        ));
    });

    for (let sigil of ['#', '##', '//', '///', '--', ';', ';;', ';;;']) {
        describe(`when dealing with ${sigil} comments`, () => {
            it(`wraps one line of ${sigil} comments correctly`, () => test(
                [`${sigil} Hello, world!  Have another line.`, 24],
                `${sigil} Hello, world!  Have\n${sigil} another line.`
            ));
            it(`wraps many lines of ${sigil} comments correctly`, () => test(
                [`${sigil} Hello, world!\n${sigil} Have another line.`, 24],
                `${sigil} Hello, world!  Have\n${sigil} another line.`
            ));
            it('recognizes leading whitespace (one line)', () => test(
                [`    ${sigil} Hello, world!  Have another.`, 24],
                `    ${sigil} Hello, world!\n    ${sigil} Have another.`

            ));
            it('recognizes leading whitespace (multi-line)', () => test(
                [`    ${sigil} Hello, world!  Have\n    ${sigil} another.`, 24],
                `    ${sigil} Hello, world!\n    ${sigil} Have another.`

            ));
        });
    }

    describe('when reflowing paragraphs with only a leading sigil', () => {
        for (let sigil of ['-', '+', '*', '<!--', '/*', '/**', '1.', 'a.', '10.']) {
            let spaces = ' '.repeat(sigil.length);
            it(`recognizes single lines beginning with ${sigil}`, () => test(
                [`${sigil} effervescently excuplatory exploratory`, 24],
                `${sigil} effervescently\n${spaces} excuplatory\n${spaces} exploratory`
            ));
        }

        it('ignores leading sigils that are part of a paragraph', () => test(
            ['1. this is a para\nitem broken up', 24],
            '1. this is a para item\nbroken up'
        ));

        it('ignores paragraphs with sigils in the middle', () => test(
            [`
This is a previously-wrapped paragraph
- it has an unfortunate dash in it.
That - shouldn't be a list.
`, 40], `
This is a previously-wrapped paragraph -
it has an unfortunate dash in it.  That
- shouldn't be a list.
`
        ));

        it('detects leading sigils with multiple lines', () => test(
            ['.. this is a list\n item broken up', 24],
            '.. this is a list item\n   broken up'
        ));

        it('detects leading sigils with lots of lines', () => test(
            ['.. This is a paragraph\n   with more than\n   two lines.', 24],
            '.. This is a paragraph\n   with more than two\n   lines.'
        ));

        it('detects leading sigils, multi-line, trailing .', () => test(
            ['.. this is a list.\n item broken up', 24],
            '.. this is a list.  item\n   broken up'
        ));
    });

    describe('when reflowing unordered lists', () => {
        it('handles list items with blank lines between them', () => test(
            [`
- This is a short list item.

- This is a longer list item, which I expect to wrap across two lines.
`, 40], `
- This is a short list item.

- This is a longer list item, which I
  expect to wrap across two lines.
`
        ));

        it('handles list items without blank lines between them', () => test(
            [`
- This is a short list item.
- This is a longer list item, which I expect to wrap across two lines.
`, 40], `
- This is a short list item.
- This is a longer list item, which I
  expect to wrap across two lines.
`
        ));

        it('re-wraps list items that were poorly-wrapped', () => test(
            [`
- This is a list item.  It's wrapped in a
 very strange way.
- This is another list
  item.  It's also wrapped
  in a slightly different way.
- This is a third list item.  Why are these
    wrapped so strangely?
`, 40], `
- This is a list item.  It's wrapped in
  a very strange way.
- This is another list item.  It's also
  wrapped in a slightly different way.
- This is a third list item.  Why are
  these wrapped so strangely?
`
        ));

        it('handles list items and paragraphs at the same time', () => test(
            [`
This is a short paragraph.

- This is a short list item.
- This is a longer list item, which I expect to wrap across two lines.

This is a much longer paragraph, which should wrap (or so I hope).
`, 40], `
This is a short paragraph.

- This is a short list item.
- This is a longer list item, which I
  expect to wrap across two lines.

This is a much longer paragraph, which
should wrap (or so I hope).
`
        ));

        it('handles nested list items gracefully', () => test(
            [`
- This is a short list item.
  - This is a nested list item.
  - This is another nested list item, which should wrap.
- This is a longer list item, which I expect to wrap across two lines.
`, 40], `
- This is a short list item.
  - This is a nested list item.
  - This is another nested list item,
    which should wrap.
- This is a longer list item, which I
  expect to wrap across two lines.
`
        ));

        it('handles list items that are cuddled up to the preceding paragraph', () => test(
            [`
This is a paragraph.
It spans multiple lines.
- This is the first list item.
2. This is the second list item.
   It's inconsistent, but that's okay.
`, 40], `
This is a paragraph.  It spans multiple
lines.
- This is the first list item.
2. This is the second list item.  It's
   inconsistent, but that's okay.
`
        ));
    });

    describe('when reflowing ordered lists', () => {
        for (let sigil of ['1.', '(1)', 'a.', 'A.', '(a)', '(A)']) {
            let spaces = ' '.repeat(sigil.length);
            it(`handles small lists that look like ${sigil}`, () => test(
                [`${sigil} foo\n${sigil} bar\n${sigil} baz`, 80],
                `${sigil} foo\n${sigil} bar\n${sigil} baz`
            ));
            it(`handles small nested lists that look like ${sigil}`, () => test(
                [`${sigil} foo\n${spaces} ${sigil} bar\n${sigil} baz`, 80],
                `${sigil} foo\n${spaces} ${sigil} bar\n${sigil} baz`
            ));
        }

        it('properly indents based on the length of the numeral', () => test(
            ['1. Mary had a little lamb.\n10. Her fleece was white as snow.', 20],
            '1. Mary had a little\n   lamb.\n10. Her fleece was\n    white as snow.'
        ));

        it('handles nested lists of different varieties', () => test(
            ['1. outer\n   - inner\n2. other outer\n   + other inner', 80],
            '1. outer\n   - inner\n2. other outer\n   + other inner'
        ));

        it('ignores the last number/word in a sentence (para context)', () => test(
            ['This is a sentence\nend.  The beginning of this line looks odd.', 40],
            'This is a sentence end.  The beginning\nof this line looks odd.'
        ));

        it('properly reflows a list that ends in a single word', () => test(
            ['1. This is a list item.\n   It ends with a\n   word.', 24],
            '1. This is a list item.\n   It ends with a word.'
        ));

        // NOTE: This is ambiguous even to humans, so this test is expected to
        // fail.
        xit('ignores the last number/word in a sentence (list context)', () => test(
            ['1. This is a sentence\n   of.  The beginning of this line looks odd.', 40],
            '1. This is a sentence of.  The beginning\n   of this line looks odd.'
        ));

        it('ignores the last number/word in a sentence (list context, 2 lines)', () => test(
            ['1. This is a sentence\n   of.  The beginning of\n   this line looks odd.', 40],
            '1. This is a sentence of.  The beginning\n   of this line looks odd.'
        ));
        it('detects nested ordered lists that might be paragraphs', () => test(
            ['1. This is a sentence\n   of.  The beginning of\n         this line looks odd.', 40],
            '1. This is a sentence\n   of.  The beginning of this line looks\n        odd.'
        ));
    });

    describe('when reflowing comments', () => {
        it('reflows paragraphs independently', () => test(
            [`
# This is a comment.  Here is the first paragraph.
#
# Here is the second paragraph.  These should be reflowed independently.
`, 40], `
# This is a comment.  Here is the first
# paragraph.
#
# Here is the second paragraph.  These
# should be reflowed independently.
`
        ));

        it('reflows lists independently', () => test(
            [`
# Here's a comment with a list embedded in it:
#
# 1. This is the first item.  It's pretty long.
# 2. Second short item.
# 3. Third, excessively long, extremely verbose and very redundant item.
#
# Another paragraph.
`, 40], `
# Here's a comment with a list embedded
# in it:
#
# 1. This is the first item.  It's
#    pretty long.
# 2. Second short item.
# 3. Third, excessively long, extremely
#    verbose and very redundant item.
#
# Another paragraph.
`
        ));

        it('reflows lists that start on the same line as a comment', () => test(
            [`
// 1. This is the first item.  Look at how long it is.
// 2. This is the second item.
`, 40], `
// 1. This is the first item.  Look at
//    how long it is.
// 2. This is the second item.
`
        ));

        it('reflows lists in block comments', () => test(
            [`
/* 1. This is the first item.  It's super long.
   2. This is the second item.  Notice how it's longer. */
`, 40], `
/* 1. This is the first item.  It's
      super long.
   2. This is the second item.  Notice
      how it's longer. */
`
        ));
    });

    // XXX Not sure why the scaffolding isn't working here. :/
    xdescribe('when invoked by the user', () => {
        let editor, editor_view;

        beforeEach(() => {
            let activationPromise = null;
            waitsForPromise(() => atom.workspace.open());

            runs(() => {
                editor = atom.workspace.getActiveTextEditor();
                editor_view = atom.views.getView(editor);

                activationPromise = atom.packages.activatePackage('magic-reflow');
            });

            waitsForPromise(() => activationPromise);
        });

        it('respects the preferred line length', () => {
            atom.config.set('editor.preferredLineLength', 4,
                            {scopeSelector: '.text.plain.null-grammar'});
            editor.setText("foo bar");
            editor.selectAll();
            atom.commands.dispatch(editor_view, 'magic-reflow:reflow');

            expect(editor.getText()).toBe("foo\nbar");
        });
    });

});
