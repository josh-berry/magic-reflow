'use babel';

const debug = false
            ? (...args) => (console.log(...args))
            : undefined;

// Things that look like list bullets or numbers.
const LIST_STYLES = [
    /^-$/,
    /^\+$/,
    /^\*$/,
    /^[0-9]{1,3}\.$/,
    /^[a-z]{1,2}\.$/,
    /^[A-Z]{1,2}\.$/,
    /^\([0-9]{1,3}\)$/,
    /^\([a-z]{1,2}\)$/,
    /^\([A-Z]{1,2}\)$/,
];

// If we see a sigil that begins with any of these prefixes, don't extend it
// when wrapping onto multiple lines.  Treat it as something that should only
// appear on the first line.
//
// (Note that this is distinct from the set of list styles, which are checked
// first.)
const DONT_EXTEND_PREFIXES = ['<!--', '/*', '(*'];

// If we see a sigil that begins with any of these prefixes, assume it should be
// extended.  This is checked after DONT_EXTEND_PREFIXES.
const EXTEND_PREFIXES = ['#', '//', ';', '--'];

// How to match a line with (possibly) a sigil, list bullet, etc. at the
// beginning.
const LINE_PATT = /^((\s*)(\S+)(\s+))(.*)$/;

// How to match punctuation.
const SIGIL_PATT = /^[`"'\[\](){}:;=+!@#$%^&*_~,.<>?/\\|-]+$/;

// How to match leading whitespace.
const LEADING_WS_PATT = /^(\s+)(.*)/;



// Some useful text and array-processing utility functions.
function is_blank_line(text) {
    return text.search(/^\s*$/) !== -1;
}

function first_in_range(array, start, end, cb) {
    for (let i = start; i < end; ++i) {
        if (cb(array[i], i, array)) return i;
    }
    return end;
}

function last_in_range(array, start, end, cb) {
    for (let i = end - 1; i >= start; --i) {
        if (cb(array[i], i, array)) return i;
    }
    return start - 1;
}

function vlen_of_tab_at(start_col, tab_vlen) {
    // Returns the visual length of a tab character, if that tab character
    // appears at the specified /start_col/.  The /tab_vlen/ parameter indicates
    // the visual length of tab characters generally (e.g. 1 tab = 8 spaces).

    return tab_vlen - (start_col % tab_vlen);
}

function vlen(text, start_col, tab_vlen) {
    // Compute the visual length of /text/, assuming (for the purposes of tab
    // alignment) it starts at column /start_col/.  The /text/ should not
    // contain any newlines.

    let vl = start_col;

    let re = /([^\t\r\n]+|[\t\r\n])/gm;
    let m;
    while (m = re.exec(text)) {
        switch (m[1]) {
            case '\t':
                vl += vlen_of_tab_at(vl, tab_vlen);
                break;
            case '\n':
            case '\r':
                throw "Text contains newlines";
            default:
                vl += m[1].length;
                break;
        }
    }

    return vl - start_col;
}

function indent_with_tabs(vlen, tab_vlen) {
    // Return a sequence of tab and space characters long enough to visually
    // indent from column 0 to /vlen/, assuming tab characters are /tab_vlen/
    // columns wide.

    let i = '';
    if (vlen >= tab_vlen) {
        let tabs = (vlen/tab_vlen)|0;
        i = i.concat('\t'.repeat(tabs));
        vlen -= tabs * tab_vlen;
    }
    return i.concat(' '.repeat(vlen));
}

function* leading_tabs_to_spaces(lines, tab_vlen) {
    // Replaces leading tab characters in each line of /lines/ with a
    // visually-appropriate number of spaces.  Assumes that tab characters are
    // typically /tab_vlen/ columns wide.

    // This is O(n^2) becuase of the vlen() call, but that should be fine since
    // we're only operating on a single line.
    for (let line of lines) {
        // Fixup all leading whitespace, to catch weird corner cases like
        // " \t \tThe rest of the line"
        yield line.replace(/^\s+/, (ws) => {
            return ws.replace(/\t/g, (m, off, t) => {
                let vl = vlen(t.substr(0, off), 0, tab_vlen);
                return ' '.repeat(vlen_of_tab_at(vl, tab_vlen));
            });
        });
    }
}

function* leading_spaces_to_tabs(lines, tab_vlen) {
    // Undoes what leading_tabs_to_spaces does -- replaces runs of space
    // characters with an appropriate number of tabs.

    for (let line of lines) {
        yield line.replace(/^\s+/, (ws) => {
            return indent_with_tabs(vlen(ws, 0, tab_vlen), tab_vlen);
        });
    }
}



// Match a line with LINE_PATT and build an object describing what's in it.
function match_line(text) {
    let obj = {
        // The original line.
        line: text,

        // 'none' if there is no sigil.
        // 'leading' if the sigil we found should appear only on the first line.
        // 'extend' if the sigil we found should appear on every line.
        sigil: 'none',

        // .first is the sigil mentioned above, or '' if none was found.  ws_pre
        // and ws_post are the whitespace before/after .first.  If .first is
        // empty, all the whitespace shows up in .ws_pre.
        ws_pre: '',
        first: '',
        ws_post: '',

        // The same as ws_pre + first + ws_post.
        leading: '',

        // The remaining text (not including the sigil or surrounding
        // whitespace)
        text: text,
    };

    let m = text.match(LINE_PATT);
    if (! m) {
        m = text.match(LEADING_WS_PATT);
        if (m) {
            obj.leading = m[1];
            obj.ws_pre = m[1];
            obj.text = m[2];
        }
        return obj;
    }

    obj.leading = m[1];
    obj.ws_pre = m[2];
    obj.first = m[3];
    obj.ws_post = m[4];
    obj.text = m[5];

    for (let s of LIST_STYLES) {
        if (obj.first.search(s) !== -1) {
            obj.sigil = 'leading';
            return obj;
        }
    }

    if (obj.first.search(SIGIL_PATT) !== -1) {
        let matching_prefix = (p, i, a) => obj.first.substr(0, p.length) === p;

        if (DONT_EXTEND_PREFIXES.findIndex(matching_prefix) !== -1) {
            obj.sigil = 'leading';
            return obj;
        }

        if (EXTEND_PREFIXES.findIndex(matching_prefix) !== -1) {
            obj.sigil = 'extend';
            return obj;
        }

        obj.sigil = obj.first.length == 1 ? 'extend' : 'leading';
        return obj;
    }

    // First word doesn't match anything like what we're looking for; put it
    // back into text.
    obj.text = obj.first.concat(obj.ws_post, obj.text);
    obj.first = '';
    obj.ws_post = '';
    obj.leading = obj.ws_pre;
    return obj;
}



export default {

    activate(state) {
        // Register command that toggles this view
        atom.commands.add('atom-text-editor', {
            'magic-reflow:reflow': (event) => this.invoke(event)
        });
    },

    deactivate() {
    },

    serialize() {
        return null;
    },

    invoke(event) {
        let editor = event.currentTarget.getModel();
        let range = editor.getSelectedBufferRange();

        // XXX need to deal with leading sigils as appropriate; means we
        // probably need to do some scanning in this neighborhood rather than
        // relying on the editor's notion of a paragraph
        if (range.isEmpty()) range = editor.getCurrentParagraphBufferRange();
        if (! range) return;

        // The reflow state object.  This is modified (or copies are
        // created) and passed around as the reflow algorithm does its work.
        let state = {
            // How long is a tab character, visually?
            tab_vlen: atom.config.get('editor.tabLength',
                {scope: editor.getRootScopeDescriptor()}),

            // How long should a line be, overall?
            line_vlen: atom.config.get('editor.preferredLineLength',
                {scope: editor.getRootScopeDescriptor()}),

            // What is the starting (visual) column?  We will assume that there
            // is a prefix that is this many columns wide, so we'll wrap the
            // text to fit in (line_vlen - start_col).
            //
            // We need both start_col and line_vlen so we can tell how much
            // visual space a leading tab takes up.  If we simply subtracted
            // from line_vlen as we process indented text, we wouldn't be able
            // to compute the visual length of tab characters correctly.
            start_col: 0,

            // When adding leading whitespace, should we use spaces or tabs?
            soft_tab: atom.config.get('editor.softTabs',
                {scope: editor.getRootScopeDescriptor()}),
        };

        let text = this.reflow(editor.getTextInRange(range), state);

        editor.getBuffer().setTextInRange(range, text);
    },

    reflow(text, state) {
        // Reflow a block of text, and return the reflowed text.
        //
        // The state object is as described above in invoke().

        if (! state.line_vlen) state.line_vlen = 80;
        if (! state.tab_vlen) state.tab_vlen = 8;
        if (! state.start_col) state.start_col = 0;
        if (state.soft_tab === undefined) state.soft_tab = true;

        let [head, body, tail] = this.head_body_tail(text);
        let useTabs = body.indexOf('\t') != -1;

        let lines = body.split(/\r\n|\r|\n/);
        let out = this.reflow_lines(
            leading_tabs_to_spaces(lines, state.tab_vlen),
            state);

        if (! state.soft_tab) {
            out = leading_spaces_to_tabs(out, state.tab_vlen);
        }

        return head.concat(Array.from(out).join('\n'), tail);
    },

    reflow_lines: function*(lines, state) {
        lines = Array.from(lines);

        if (debug) debug('reflowing:', state, lines);

        // Break the text into blocks, and reflow each block separately.
        for (let i = 0; i < lines.length; ) {
            // Blank lines always break blocks.  We must handle them specially
            // here since they will get swallowed by the rewrap logic otherwise.
            if (is_blank_line(lines[i])) {
                yield lines[i];
                ++i;
                continue;
            }

            let [ni, out_lines] = this.consume_block(lines, i, state);
            if (ni < i + 1) {
                throw `consume didn't advance (from ${i}) target ${ni}`;
            }
            i = ni;
            yield* out_lines;
        }

        if (debug) debug('done reflowing');
    },

    retry_without_prefix: function*(prefix, lines, state) {
        if (debug) debug(`retrying without prefix: ${prefix}`);

        let reflowed = this.remove_and_reflow(prefix, lines, state);

        for (let line of reflowed) {
            line = prefix.concat(line);
            yield line;
        }
    },

    retry_without_leading: function*(leading, lines, state) {
        if (debug) debug(`retrying without leading: ${leading}`);

        let reflowed = this.remove_and_reflow(leading, lines, state);
        let ilen = vlen(leading, state.start_col, state.tab_vlen);
        let indent = ' '.repeat(ilen);

        let first = true;
        for (let line of reflowed) {
            line = (first ? leading : indent).concat(line);
            yield line;
            first = false;
        }
    },

    remove_and_reflow(prefix, lines, state) {
        return this.reflow_lines(Array.from(
            this.remove_prefix_and_ws(prefix, lines)), {
                line_vlen: state.line_vlen,
                tab_vlen: state.tab_vlen,
                start_col: state.start_col
                    + vlen(prefix, state.start_col, state.tab_vlen),
                soft_tab: state.soft_tab,
            });
    },

    remove_prefix_and_ws: function*(prefix, lines) {
        let remove_re = new RegExp(`^\\s{0,${prefix.length}}`);
        for (line of lines) {
            let pf = line.substr(0, prefix.length);
            if (pf === prefix) {
                yield line.substr(prefix.length);
            } else {
                yield line.replace(remove_re, '');
            }
        }
    },

    consume_block(lines, start, state) {
        // Find the end of the next block.  Return the line number and a
        // generator that yields the reflowed lines for the block.
        //
        // ARGUMENTS:
        //
        // lines: The array of lines we are operating on currently
        //
        // start: The index of the first line in the array that we should be
        // concerned with.  Prior lines have already been reflowed.
        //
        // state: A state object, as described in invoke() above.
        //
        // ALGORITHM:
        //
        // When looking for and reflowing blocks, here are the main cases we
        // need to handle:
        //
        // Case 0 -- only one line.  There are a number of variants of this
        // case, but we basically look at the beginning of the line and guess.
        // It degenerates into one of: case 1a, case 2a.
        //
        // Case 1a -- paragraph:
        //
        //     This is a paragraph.  We need to preserve any block-style indent
        //     when wrapping.
        //
        // Case 1b -- paragraph that looks deceptively like a list:
        //
        //     This is a paragraph that might contain a list,
        //     because it has a sentence that ends with the number
        //     1.  If the 1 lands at the beginning of a line, the
        //     rest of the paragraph might get reflowed incorrectly.
        //
        // Case 1c -- paragraph that looks like a list in a different way:
        //
        //     I.  Like.  Green.  Eggs.  And.  Ham.
        //     No, seriously, they're delicious.
        //
        // Case 2a -- a list:
        //
        //     1. This is a list broken by blank spaces -- we'll only see
        //        one list item at a time.
        //
        // Case 2b -- multiple list items, one per line:
        //
        //     1. This is a list, but there is one list item per line.
        //     2. Sort of like this.
        //     3. Another list item.
        //
        // Case 3x -- a paragraph followed by a list (where the paragraph is one
        // of the 1x cases):
        //
        //     This is not a list, it's just a paragraph. All lines have the
        //     same indentation.
        //     1. This is a list.
        //     2. It is not part of the paragraph above.
        //
        // CASES NOT HANDLED:
        //
        // Case 4a -- paragraph with leading indent:
        //
        //         This is a paragraph with a leading indent.
        //     Notice how the second line has less indent than
        //     the first.
        //
        // Case 4b -- paragraph with leading indent (mistaken for a list):
        //
        //         I.  This is a paragraph with a leading indent.
        //     Notice how the second line has less indent than
        //     the first.
        //
        // Case 4c -- paragraph with leading indent (mistaken for a list):
        //
        //         I.  This is a paragraph with a leading indent.
        //     A.  Notice how the second line has less indent than
        //     the first.
        //
        // Note that any of the list cases might have sub-lists inside of them,
        // which could lead to case 4 happening as a sub-list (where the
        // paragraph is actually the enclosing list item).  We don't need to
        // handle sub-lists here; we can handle them by treating each list item
        // (sans leading sigil) as its own block.

        // Never go beyond a blank line; that should be considered a hard-stop
        // on any block.
        let blank_end = first_in_range(lines, start, lines.length,
            (l, i, a) => is_blank_line(l));

        if (debug) debug(`block <= [${start},${blank_end}): `, lines[start]);

        let startm = match_line(lines[start]);
        let start_indent = startm.ws_pre.length;

        // Check if we only have one line before the next blank line.  If so,
        // just treat the single line as its own block.
        if (start + 1 == blank_end) {
            if (debug) debug('= single line only');
            return this.consume_single_line(lines, start, startm, state);
        }

        // Else this block may extend beyond a single line.

        if (startm.sigil === 'leading') {
            // The first line has a leading sigil; we need to figure out if it's
            // actually leading or if it might be a false positive (e.g. case
            // 1c).
            let end = first_in_range(lines, start + 1, blank_end,
                (l, i, a) => match_line(l).ws_pre.length <= start_indent);

            if (end > start + 1) {
                // Looks like nested indentation -- must be 2a.
                if (debug) debug(`= preformatted leading [${start}, ${end})`);
                return [end, this.retry_without_leading(
                    startm.leading, lines.slice(start, end), state)];
            }

            // Check if it's case 1c or 2b.
            //
            // For 1c, look for following non-sigil lines at the same
            // indentation level.  We ignore things that look like they're
            // indented; if we see a non-sigil line after this, we assume
            // everything in between falls under 1c.
            //
            // Anything that looks like this will get treated as a single
            // paragraph, but that's okay since people usually parse it as an
            // unreadable mess anyway:
            //
            //     This is a paragraph.  It might
            //     span multiple lines.
            //     1. This is a list.
            //     2. This is another list item.
            //     This is another paragraph, that
            //     also spans multiple lines.
            //
            let para_end = 1 + last_in_range(lines, start, blank_end,
                (l, i, a) => {
                    let m = match_line(l);
                    return m.ws_pre.length <= start_indent
                        && m.sigil !== 'leading';
                });

            if (para_end == start) {
                // If there is no non-sigil line, this is a case 2b list.  Tear
                // off the first item and reflow it.
                if (debug) debug(`= single-line list item`);
                return [start + 1, this.retry_without_leading(
                    startm.leading, [lines[start]], state)];
            }

            // Could be 1c or 3c.  Handle 1c and advance; we'll pick up the list
            // portions of 3c later.
            if (debug) debug(`= paragraph w/leading [${start}, ${para_end})`);
            return this.consume_para(lines, start, para_end, state);
        }

        // Could be 1a/1b, or 3a/3b.
        //
        // Same as above; find the last non-indented, non-sigil line, and tear
        // it off as a paragraph.

        let maybe_end = 1 + last_in_range(lines, start, blank_end,
            (l, i, a) => {
                let m = match_line(l);
                return m.ws_pre.length <= start_indent && m.sigil !== 'leading';
            });

        // maybe_end will be pointing to a line that is indented, has a sigil,
        // or both.  If the line has a sigil, assume this really is the end of
        // the paragraph.  Otherwise, this is just hanging/messed-up indentation
        // of the form:
        //
        // Hello, world!  This is a paragraph
        //   with weird indentation.
        //
        // Include any such lines in the current paragraph.

        let para_end = first_in_range(lines, maybe_end, blank_end,
            (l, i, a) => {
                let m = match_line(l);
                return m.sigil !== 'none';
            });

        if (debug) debug(`= paragraph [${start}, ${para_end})`)
        return this.consume_para(lines, start, para_end, state);
    },

    consume_para(lines, start, end, state) {
        let para = lines.slice(start, end);

        // The "paragraph" might actually be a succession of single-line
        // comments which contain their own set of blocks.  If so, we need to
        // strip and reflow within the comment block.
        let prefix = this.common_prefix(para);
        if (prefix !== '') {
            return [end, this.retry_without_prefix(prefix, para, state)];
        }

        // This is a garden-variety paragraph.  Wrap it accordingly.
        return [end, this.wrap_para(para.join('\n'), state)];
    },

    consume_single_line(lines, start, startm, state) {
        let gen;

        if (startm.sigil == 'leading') {
            gen = this.retry_without_leading(
                startm.leading, [lines[start]], state);

        } else if (startm.leading !== '') {
            gen = this.retry_without_prefix(
                startm.leading, [lines[start]], state);

        } else {
            // Garden-variety paragraph, no whitespace; reflow it.
            gen = this.wrap_para(lines[start], state);
        }

        return [start + 1, gen];
    },

    wrap_para: function*(text, state) {
        // Wrap /text/ as a single paragraph, yielding lines of wrapped text
        // that are no longer than /fill/.

        if (debug) debug('wrapping paragraph:', text, state);

        // XXX firstFill isn't used anymore, with the support for leading
        // indents gone.
        text = text
            // SPECIAL CASE: Sentences that end at the end of a line should have
            // two spaces after them.
            .replace(/([.!?])\s*\n\s*/gm, '$1  ')
            .replace(/\n\s*/gm, ' ');

        let res = [];
        let start = 0;
        let end = start;
        let vl = state.start_col;

        for (let [run, ws, word] of this.segments_of(text)) {
            let newend = end + ws.length + word.length;
            let newvl = vl + vlen(run, vl, state.tab_vlen);

            if (end == start) {
                // Current line is empty. Skip over leading whitespace that
                // would otherwise get put at the beginning of the line.
                start += ws.length;
                newvl = vl + vlen(word, vl, state.tab_vlen);

            } else if (newvl > state.line_vlen) {
                // Current line is full.  Emit what we have and start the next
                // line.
                yield text.substr(start, end - start);

                // Skip leading whitespace on the next line, and start the line
                // with the current word.
                start = end + ws.length;
                newvl = state.start_col + vlen(word, vl, state.tab_vlen);
            }

            end = newend;
            vl = newvl;
        }

        if (start != end) {
            yield text.substr(start, end - start);
        }
    },

    common_prefix(lines) {
        // Finds and returns any non-alphanumeric prefix that is common to all
        // the lines.  If there are 0 or 1 lines, we assume there is no common
        // prefix.

        if (lines.length < 2) return '';

        let pf = '';
        let testpf = '';

        while (testpf.length < lines[0].length) {
            pf = testpf;
            testpf = lines[0].substr(0, testpf.length + 1);

            // Letters/numbers/etc. cannot be part of a prefix.
            if (testpf.search(/\w/) !== -1) return pf;

            // Check if any line doesn't match the test prefix.
            for (line of lines) {
                if (testpf.length > line.length) return pf;
                if (line.substr(0, testpf.length) !== testpf) return pf;
            }
        }

        return testpf;
    },

    head_body_tail: function(text) {
        // Split text into:
        // [leading whitespace, everything else, trailing whitespace]

        let head = (text.match(/^\s*\n/) || [''])[0];
        let tail = (text.match(/\n\s*$/) || [''])[0];
        let body = text.substr(head.length,
                text.length - head.length - tail.length);
        return [head, body, tail];
    },

    segments_of: function*(text) {
        // Split /text/ at word boundaries, yielding [run, ws, word] tuples
        // where /ws/ is the whitespace that appears before /word/, and /run/ is
        // ws.concat(word).

        let span = /(\s*)(\S+)/gm;
        let m;
        while (m = span.exec(text)) {
            yield m;
        }
    },

    // Exports for testing purposes, used in the spec file
    vlen: vlen,
    indent_with_tabs: indent_with_tabs,
    leading_tabs_to_spaces: leading_tabs_to_spaces,
    leading_spaces_to_tabs: leading_spaces_to_tabs,
};
