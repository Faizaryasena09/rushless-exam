const html = `<p><span class="bold">A.</span> 1</p>
<p><b>*B)</b> <i>2</i></p>
<p><i>C.</i> 3</p>
<p>D  . 4</p>
<p>A) Yes</p>
<p>B) No*</p>`;

const htmlTagSpacing = '(?:\\s*<[^>]+>\\s*|\\s+|&nbsp;)*';
const optRegexStr = '^' + htmlTagSpacing + '(\\**)' + htmlTagSpacing + '([A-Za-z])' + htmlTagSpacing + '[.)]' + htmlTagSpacing + '(.*)';
const optRegex = new RegExp(optRegexStr, 's');

const lines = html.split('\n');

for (const line of lines) {
    const match = line.match(optRegex);
    if (match) {
        console.log("MATCH", match[1], match[2], match[3]);
    }
}
