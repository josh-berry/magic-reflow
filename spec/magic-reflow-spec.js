'use babel';

import MagicReflow from '../lib/magic-reflow';

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g.
// `fit` or `fdescribe`).  Remove the `f` to unfocus the block.

function test(test_args, expected) {
    let actual = MagicReflow.reflow(...test_args);
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

    describe('when dealing with leading space characters', () => {
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

    for (let sigil of ['#', '//', '///', '--', ';', ';;', ';;;']) {
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
        for (let sigil of ['-', '+', '*', '<!--', '/*']) {
            let spaces = ' '.repeat(sigil.length);
            it(`recognizes single lines beginning with ${sigil}`, () => test(
                [`${sigil} effervescently excuplatory exploratory`, 24],
                `${sigil} effervescently\n${spaces} excuplatory\n${spaces} exploratory`
            ));
        }

        it('detects leading sigils with multiple lines', () => test(
            ['.. this is a list\nitem broken up', 24],
            '.. this is a list item\n   broken up'
        ));

        it('detects leading sigils, multi-line, trailing .', () => test(
            ['.. this is a list.\nitem broken up', 24],
            '.. this is a list.  item\n   broken up'
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
