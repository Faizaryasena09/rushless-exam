import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import mammoth from 'mammoth';
import { sessionOptions } from '@/app/lib/session';

// Helper for ASYNC string replace
async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

function getRomanNumeral(num) {
    const lookup = { m: 1000, cm: 900, d: 500, cd: 400, c: 100, xc: 90, l: 50, xl: 40, x: 10, ix: 9, v: 5, iv: 4, i: 1 };
    let roman = '';
    for (let i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
}

function getFormatForHtmlLi(liText, xmlListItems, searchState) {
    if (!xmlListItems || xmlListItems.length === 0) {
        return null;
    }
    
    if (searchState.currentIndex >= xmlListItems.length) {
        return xmlListItems[xmlListItems.length - 1];
    }

    const cleanLi = liText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    if (cleanLi === '') {
        return xmlListItems[searchState.currentIndex];
    }
    
    for (let i = searchState.currentIndex; i < xmlListItems.length; i++) {
        const cleanXml = xmlListItems[i].text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        const isExact = (cleanXml !== '' && cleanLi === cleanXml);
        const isSub = (cleanXml.length >= 4 && cleanLi.length >= 4) && (cleanLi.includes(cleanXml) || cleanXml.includes(cleanLi));

        if (isExact || isSub) {
            searchState.currentIndex = i + 1;
            
            // Consume subsequent XML items merged into this single HTML li
            let nextIdx = i + 1;
            let currentCombined = cleanXml;
            while (nextIdx < xmlListItems.length) {
                const nextXml = xmlListItems[nextIdx].text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (nextXml !== '' && cleanLi.includes(currentCombined + nextXml)) {
                    currentCombined += nextXml;
                    searchState.currentIndex = nextIdx + 1;
                    nextIdx++;
                } else {
                    break;
                }
            }
            
            return xmlListItems[i];
        }
    }
    
    return xmlListItems[searchState.currentIndex];
}

function restoreListMarkers(html, documentListFormats) {
    let output = '';
    let pos = 0;
    
    const tokenRegex = /(<\/?[a-z0-9]+[^>]*>|\[Multiple Choice\]|\[Pilihan Ganda\]|\[OPT\]|\[MATCHING\]|\[Menjodohkan\]|\[ESSAY\]|\[Esai\]|\[Uraian\]|\b(?:ans|jawaban|kunci|key)\s*:)/gi;
    
    let currentQuestionType = 'multiple_choice';
    let isOptSection = false;
    let matchingListCount = 0;
    
    const listStack = [];
    const searchState = { currentIndex: 0 };
    
    let lastMatch;
    let lastIndex = 0;
    
    while ((lastMatch = tokenRegex.exec(html)) !== null) {
        const textBefore = html.substring(lastIndex, lastMatch.index);
        output += textBefore;
        
        const token = lastMatch[0];
        const tokenLower = token.toLowerCase();
        
        if (tokenLower.includes('[multiple choice]') || tokenLower.includes('[pilihan ganda]')) {
            currentQuestionType = 'multiple_choice';
            isOptSection = false;
            output += token;
        } else if (tokenLower.includes('[matching]') || tokenLower.includes('[menjodohkan]')) {
            currentQuestionType = 'matching';
            matchingListCount = 0;
            output += token;
        } else if (tokenLower.includes('[essay]') || tokenLower.includes('[esai]') || tokenLower.includes('[uraian]')) {
            currentQuestionType = 'essay';
            output += token;
        } else if (tokenLower.includes('[opt]')) {
            isOptSection = true;
            output += token;
        } else if (tokenLower.match(/\b(?:ans|jawaban|kunci|key)\s*:/)) {
            isOptSection = false;
            output += token;
        } else if (tokenLower.startsWith('<ol') || tokenLower.startsWith('<ul')) {
            const isOl = tokenLower.startsWith('<ol');
            listStack.push({
                isOl,
                index: 0
            });
            output += token;
        } else if (tokenLower.startsWith('</ol') || tokenLower.startsWith('</ul')) {
            const popped = listStack.pop();
            if (popped && currentQuestionType === 'matching' && listStack.length === 0) {
                matchingListCount++;
            }
            output += token;
        } else if (tokenLower.startsWith('<li')) {
            const currentList = listStack[listStack.length - 1];
            if (currentList) {
                currentList.index++;
                const index = currentList.index;
                
                let prefix = '';
                
                // Extract clean text content of the list item to run text-matching alignment
                const itemStart = lastMatch.index + token.length;
                let nextStopIndex = html.length;
                const nextLi = html.indexOf('<li', itemStart);
                const nextLiClose = html.indexOf('</li>', itemStart);
                const nextOl = html.indexOf('<ol', itemStart);
                const nextOlClose = html.indexOf('</ol>', itemStart);
                const nextUl = html.indexOf('<ul', itemStart);
                const nextUlClose = html.indexOf('</ul>', itemStart);
                
                const indices = [nextLi, nextLiClose, nextOl, nextOlClose, nextUl, nextUlClose].filter(idx => idx !== -1);
                if (indices.length > 0) {
                    nextStopIndex = Math.min(...indices);
                }
                
                const liTextRaw = html.substring(itemStart, nextStopIndex);
                const liText = liTextRaw.replace(/<[^>]+>/g, '').trim();
                
                let xmlFormat = null;
                if (documentListFormats && documentListFormats.length > 0) {
                    xmlFormat = getFormatForHtmlLi(liText, documentListFormats, searchState);
                }
                
                if (currentQuestionType === 'multiple_choice' && isOptSection) {
                    prefix = String.fromCharCode(64 + index) + '. ';
                                } else if (xmlFormat) {
                    const fmt = xmlFormat.format;
                    const idx = xmlFormat.index || index;
                    if (fmt === 'decimal') {
                        prefix = idx + '. ';
                    } else if (fmt === 'lowerLetter') {
                        prefix = String.fromCharCode(96 + idx) + '. ';
                    } else if (fmt === 'upperLetter') {
                        prefix = String.fromCharCode(64 + idx) + '. ';
                    } else if (fmt === 'lowerRoman') {
                        prefix = getRomanNumeral(idx) + '. ';
                    } else if (fmt === 'upperRoman') {
                        prefix = getRomanNumeral(idx).toUpperCase() + '. ';
                    } else if (fmt === 'bullet') {
                        prefix = '• ';
                    } else {
                        prefix = idx + '. ';
                    }
                } else {
                    if (currentQuestionType === 'multiple_choice') {
                        if (currentList.isOl) {
                            prefix = index + '. ';
                        } else {
                            prefix = '• ';
                        }
                    } else if (currentQuestionType === 'matching') {
                        if (matchingListCount === 0) {
                            prefix = index + '. ';
                        } else {
                            prefix = String.fromCharCode(64 + index) + '. ';
                        }
                    } else {
                        if (currentList.isOl) {
                            prefix = index + '. ';
                        } else {
                            prefix = '• ';
                        }
                    }
                }
                
                output += token + prefix;
            } else {
                output += token;
            }
        } else {
            output += token;
        }
        
        lastIndex = tokenRegex.lastIndex;
    }
    
    output += html.substring(lastIndex);
    return output;
}

export async function POST(request) {
    try {
        const session = await getIronSession(await cookies(), sessionOptions);
        if (!session.user || session.user.roleName === 'student') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ message: 'File is required' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let htmlFn = '';
        let documentListFormats = [];

        const isDocx = file.name.toLowerCase().endsWith('.docx');

        if (isDocx) {
            try {
                // Parse word/document.xml and word/numbering.xml to extract exact list formats
                try {
                    const zip = new AdmZip(buffer);
                    const docXml = zip.readAsText('word/document.xml');
                    let numberingXml = '';
                    try {
                        numberingXml = zip.readAsText('word/numbering.xml');
                    } catch (e) {}

                    if (numberingXml) {
                        const abstractNumFormats = {};
                        const abstractNumBlocks = numberingXml.match(/<w:abstractNum[^>]*>[\s\S]*?<\/w:abstractNum>/g) || [];
                        abstractNumBlocks.forEach(block => {
                            const absIdMatch = block.match(/w:abstractNumId="(\d+)"/);
                            if (absIdMatch) {
                                const absId = absIdMatch[1];
                                abstractNumFormats[absId] = {};
                                const lvlBlocks = block.match(/<w:lvl[^>]*>[\s\S]*?<\/w:lvl>/g) || [];
                                lvlBlocks.forEach(lvlBlock => {
                                    const ilvlMatch = lvlBlock.match(/w:ilvl="(\d+)"/);
                                    const numFmtMatch = lvlBlock.match(/<w:numFmt w:val="([^"]+)"/);
                                    if (ilvlMatch && numFmtMatch) {
                                        abstractNumFormats[absId][ilvlMatch[1]] = numFmtMatch[1];
                                    }
                                });
                            }
                        });

                        const numIdFormats = {};
                        const numBlocks = numberingXml.match(/<w:num[^>]*>[\s\S]*?<\/w:num>/g) || [];
                        numBlocks.forEach(numBlock => {
                            const numIdMatch = numBlock.match(/w:numId="(\d+)"/);
                            const absMatch = numBlock.match(/<w:abstractNumId w:val="(\d+)"/);
                            if (numIdMatch && absMatch) {
                                const numId = numIdMatch[1];
                                const absIdRef = absMatch[1];
                                numIdFormats[numId] = abstractNumFormats[absIdRef] || {};
                            }
                        });

                        const numCounts = {};
                        const paragraphMatches = docXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || [];
                        paragraphMatches.forEach(p => {
                            const numPrMatch = p.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
                            if (numPrMatch) {
                                const numIdMatch = numPrMatch[1].match(/<w:numId w:val="(\d+)"/);
                                const ilvlMatch = numPrMatch[1].match(/<w:ilvl w:val="(\d+)"/);
                                const numId = numIdMatch ? numIdMatch[1] : null;
                                const ilvl = ilvlMatch ? ilvlMatch[1] : '0';
                                const numFmt = (numIdFormats[numId] && numIdFormats[numId][ilvl]) || 'decimal';
                                
                                const key = `${numId}-${ilvl}`;
                                if (!numCounts[key]) {
                                    numCounts[key] = 0;
                                }
                                numCounts[key]++;
                                const listIndex = numCounts[key];
                                
                                const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
                                const text = textMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
                                
                                documentListFormats.push({ text: text.trim(), format: numFmt, index: listIndex });
                            }
                        });
                    }
                } catch (zipError) {
                    console.error('[PREVIEW] Failed to extract list formatting:', zipError);
                }

                // Convert to html with Base64 inline images
                const options = {
                    styleMap: ["u => u", "strike => del"],
                    convertImage: mammoth.images.imgElement(async (image) => {
                        const imgBuffer = await image.readAsBuffer();
                        const base64 = imgBuffer.toString('base64');
                        return { src: `data:${image.contentType};base64,${base64}` };
                    })
                };
                const result = await mammoth.convertToHtml({ buffer }, options);
                htmlFn = result.value;
            } catch (docxError) {
                return NextResponse.json({ message: 'Failed to process DOCX file. ' + docxError.message }, { status: 400 });
            }
        } else {
            // ZIP handling
            try {
                const zip = new AdmZip(buffer);
                const zipEntries = zip.getEntries();
                const htmlEntry = zipEntries.find(entry => entry.entryName.match(/\.(htm|html)$/i));

                if (!htmlEntry) {
                    return NextResponse.json({ message: 'No .htm or .html file found inside the zip.' }, { status: 400 });
                }

                const rawBuffer = htmlEntry.getData();
                let htmlContent = iconv.decode(rawBuffer, 'win1252');
                if (htmlContent.match(/charset=["']?utf-8/i)) {
                    htmlContent = rawBuffer.toString('utf8');
                }

                const imgRegex = /<(?:img|v:imagedata)[^>]*src=["']?([^"'\s>]+)["']?[^>]*>/gi;
                htmlFn = await replaceAsync(htmlContent, imgRegex, async (match, src) => {
                    const searchSrc = decodeURIComponent(src);
                    const filename = searchSrc.split('/').pop().split('\\').pop();
                    const imgEntry = zipEntries.find(entry => 
                        entry.entryName.replace(/\\/g, '/').endsWith('/' + filename) ||
                        entry.entryName.replace(/\\/g, '/') === filename
                    );
                    if (imgEntry) {
                        const imgBuffer = imgEntry.getData();
                        const extension = filename.split('.').pop() || 'png';
                        const base64 = imgBuffer.toString('base64');
                        return `<img src="data:image/${extension};base64,${base64}" />`;
                    }
                    return match;
                });
            } catch (zipError) {
                return NextResponse.json({ message: 'Failed to process ZIP file. ' + zipError.message }, { status: 400 });
            }
        }

        // Restore list markers
        const finalizedHtml = restoreListMarkers(htmlFn, documentListFormats);

        return NextResponse.json({ html: finalizedHtml });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
