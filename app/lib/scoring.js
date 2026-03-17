/**
 * Shared scoring logic for questions
 */

export function calculateQuestionScore(qInfo, studentAnswer) {
    if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
        return 0;
    }

    let earnedForThisQuestion = 0;

    if (qInfo.type === 'multiple_choice_complex') {
        const correctKeys = qInfo.correct.split(',').map(k => k.trim()).filter(k => k);
        const studentKeys = studentAnswer.split(',').map(k => k.trim()).filter(k => k);
        
        // Use Sets for order-independent comparison
        const correctSet = new Set(correctKeys);
        const studentSet = new Set(studentKeys);
        
        if (qInfo.strategy === 'pgk_strict') {
            // Strict: All correct must be selected AND no incorrect ones
            const isPerfect = correctKeys.length === studentKeys.length && 
                             correctKeys.every(k => studentSet.has(k));
            
            if (isPerfect) {
                earnedForThisQuestion = qInfo.points;
            }
        } else if (qInfo.strategy === 'pgk_any') {
            // Any Match: At least 1 correct must be selected.
            const correctPicked = studentKeys.filter(k => correctSet.has(k)).length;
            
            if (correctPicked > 0) {
                earnedForThisQuestion = qInfo.points;
            }
        } else if (qInfo.strategy === 'pgk_additive') {
            // Additive: Each correct choice awards the FULL points independently.
            const correctPicked = studentKeys.filter(k => correctSet.has(k)).length;
            earnedForThisQuestion = correctPicked * qInfo.points;
        } else {
            // Proportional Partial (pgk_partial): Ratio of correct selections vs total correct needed.
            const correctPicked = studentKeys.filter(k => correctSet.has(k)).length;
            if (correctKeys.length > 0) {
                earnedForThisQuestion = (correctPicked / correctKeys.length) * qInfo.points;
            }
        }
    } else if (qInfo.type === 'essay') {
        const keywords = qInfo.metadata.keywords || [];
        if (qInfo.strategy === 'essay_any_keyword') {
            // Any Keyword: Full points if at least 1 keyword matches
            if (keywords.length > 0) {
                const cleanAnswer = studentAnswer
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .toLowerCase()
                    .trim();

                const isAnyMatch = keywords.some(kw => {
                    const cleanKw = kw.trim().toLowerCase();
                    return cleanKw && cleanAnswer.includes(cleanKw);
                });
                
                if (isAnyMatch) {
                    earnedForThisQuestion = qInfo.points;
                }
            }
        } else if (qInfo.strategy === 'essay_strict_keywords') {
            // Strict Keywords: Full points ONLY if ALL keywords match
            if (keywords.length > 0) {
                const cleanAnswer = studentAnswer
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .toLowerCase()
                    .trim();

                const allMatch = keywords.every(kw => {
                    const cleanKw = kw.trim().toLowerCase();
                    return cleanKw && cleanAnswer.includes(cleanKw);
                });
                
                if (allMatch) {
                    earnedForThisQuestion = qInfo.points;
                }
            }
        } else if (qInfo.strategy === 'essay_keywords') {
            // Keyword Ratio (Standard): Proportional points based on match count
            if (keywords.length > 0) {
                const cleanAnswer = studentAnswer
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .toLowerCase()
                    .trim();

                let matchCount = 0;
                keywords.forEach(kw => {
                    const cleanKw = kw.trim().toLowerCase();
                    if (cleanKw && cleanAnswer.includes(cleanKw)) {
                        matchCount++;
                    }
                });
                
                earnedForThisQuestion = (matchCount / keywords.length) * qInfo.points;
            }
        }
 else {
            // Manual grading remains manual (0 or previously set)
            // Note: If we had a column for manual score, we'd handle it here.
            earnedForThisQuestion = 0; 
        }
    } else {
        // multiple_choice or true_false
        if (studentAnswer === qInfo.correct) {
            earnedForThisQuestion = qInfo.points;
        }
    }

    return earnedForThisQuestion;
}
