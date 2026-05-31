const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

function parseHtmlContentSimulated(rawHtml) {
    // 1. Decode entities
    const decodedRaw = String(rawHtml || '').replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ');
    const html = decodedRaw;
    
    // Normalize newlines
    const normalizedHtml = html.replace(/[\r\n]+/g, ' ');

    // Table placeholder replacement
    const tableMap = {};
    let tableCounter = 0;
    let tableProcessedHtml = normalizedHtml.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
        const placeholder = `__TABLE_${tableCounter}__`;
        tableMap[placeholder] = match;
        tableCounter++;
        return '\n' + placeholder + '\n';
    });

    let processedHtml = tableProcessedHtml;

    // Split into lines
    const lines = processedHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/?(?:span|font)[^>]*>/gi, '')
        .replace(/<\/?(?:html|head|body|title|meta|link|p|div|ul|ol|li|h[1-6])[^>]*>/gi, '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l);

    // Restore placeholders
    const restoredLines = lines.map(line => {
        let restored = line;
        for (const [placeholder, tableTag] of Object.entries(tableMap)) {
            restored = restored.replace(new RegExp(placeholder, 'g'), tableTag);
        }
        return restored;
    });

    console.log("=== RESTORED LINES ===");
    restoredLines.forEach((l, idx) => console.log(`${idx}: ${l}`));

    // Simulate routing
    const questions = [];
    let currentQuestion = null;
    let currentSection = null;

    const finalizeQuestion = (q) => {
        // Strip out question prefix
        let questionText = q.question_text_lines.join(' ');
        questionText = questionText.replace(/^(\s*(?:<[^>]+>\s*)*)\d+\s*[.)]\s*/, '$1').trim();
        
        let result = {
            question_type: q.question_type,
            question_text: questionText,
            options: q.opt_lines,
            ans_line: q.ans_line
        };

        if (q.question_type === 'multiple_choice') {
            const cleanOpts = q.opt_lines.map(o => o.replace(/<[^>]+>/g, '').trim());
            const isTF = cleanOpts.length === 2 && cleanOpts.every(o => o.toLowerCase() === 'benar' || o.toLowerCase() === 'salah');
            if (isTF) result.question_type = 'true_false';
        }
        return result;
    };

    restoredLines.forEach(line => {
        const cleanLine = line.replace(/<[^>]+>/g, '').trim();
        const typeMatch = cleanLine.match(/^\s*\[(Multiple Choice|Pilihan Ganda|ESSAY|Esai|Uraian|MATCHING|Menjodohkan)\]/i);
        
        if (typeMatch) {
            if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));
            currentQuestion = {
                question_type: 'multiple_choice',
                question_text_lines: [],
                opt_lines: [],
                ans_line: null
            };
            currentSection = 'question';
            return;
        }

        if (currentQuestion && currentQuestion.ans_line !== null) {
            questions.push(finalizeQuestion(currentQuestion));
            currentQuestion = {
                question_type: 'multiple_choice',
                question_text_lines: [line],
                opt_lines: [],
                ans_line: null
            };
            currentSection = 'question';
            return;
        }

        const isTableLine = /<\/?(?:table|tr|td|th|tbody|thead|tfoot)\b/i.test(line);

        if (currentQuestion) {
            const isNumbered = cleanLine.match(/^\s*\d+\s*[.)]/);
            const isPrevComplete = currentQuestion.opt_lines.length > 0 || currentQuestion.ans_line !== null;
            if (isNumbered && isPrevComplete && !isTableLine) {
                questions.push(finalizeQuestion(currentQuestion));
                currentQuestion = {
                    question_type: 'multiple_choice',
                    question_text_lines: [line],
                    opt_lines: [],
                    ans_line: null
                };
                currentSection = 'question';
                return;
            }
        }

        if (!currentQuestion) {
            const isNumbered = cleanLine.match(/^\s*\d+\s*[.)]/);
            if (isNumbered) {
                currentQuestion = {
                    question_type: 'multiple_choice',
                    question_text_lines: [line],
                    opt_lines: [],
                    ans_line: null
                };
                currentSection = 'question';
            }
            return;
        }

        if (currentQuestion && currentSection === 'question' && !isTableLine) {
            const isOptionStart = cleanLine.match(/^\s*[aA]\s*[.)\-:]\s+/);
            if (isOptionStart) {
                currentSection = 'options';
            }
        }

        const ansMatch = cleanLine.match(/^\s*(?:ans|jawaban|kunci|key)\s*:\s*(.*)/i);
        if (ansMatch) {
            currentQuestion.ans_line = ansMatch[1].trim();
            currentSection = null;
            return;
        }

        if (currentSection === 'question') {
            currentQuestion.question_text_lines.push(line);
        } else if (currentSection === 'options') {
            currentQuestion.opt_lines.push(line);
        }
    });

    if (currentQuestion) {
        questions.push(finalizeQuestion(currentQuestion));
    }

    console.log("=== PARSED QUESTIONS ===");
    console.log(JSON.stringify(questions, null, 2));
}

async function main() {
    const docPath = path.join(__dirname, '../public/Template Soal Rushless.docx');
    const result = await mammoth.convertToHtml({ path: docPath });
    parseHtmlContentSimulated(result.value);
}

main().catch(console.error);
