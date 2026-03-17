
import { calculateQuestionScore } from '../app/lib/scoring.js';

const testCases = [
    {
        name: "PGK Partial: 2/4 correct",
        qInfo: {
            type: 'multiple_choice_complex',
            correct: 'A,B,C,D',
            points: 20,
            strategy: 'pgk_partial'
        },
        answer: 'A,B',
        expected: 10
    },
    {
        name: "PGK Additive: 2 correct",
        qInfo: {
            type: 'multiple_choice_complex',
            correct: 'A,B,C,D',
            points: 20,
            strategy: 'pgk_additive'
        },
        answer: 'A,B',
        expected: 40
    },
    {
        name: "PGK Additive: 0 correct",
        qInfo: {
            type: 'multiple_choice_complex',
            correct: 'A,B,C,D',
            points: 20,
            strategy: 'pgk_additive'
        },
        answer: 'E,F',
        expected: 0
    },
    {
        name: "PGK Any: 1 correct",
        qInfo: {
            type: 'multiple_choice_complex',
            correct: 'A,B',
            points: 20,
            strategy: 'pgk_any'
        },
        answer: 'A',
        expected: 20
    }
];

testCases.forEach(tc => {
    const actual = calculateQuestionScore(tc.qInfo, tc.answer);
    console.log(`[${tc.name}] Expected: ${tc.expected}, Actual: ${actual}, Result: ${actual === tc.expected ? 'PASS' : 'FAIL'}`);
});
