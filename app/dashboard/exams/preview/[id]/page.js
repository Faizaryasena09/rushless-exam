'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

// --- Icons Component ---
const Icons = {
    Clock: () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    CheckCircle: () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    ArrowLeft: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
    ),
    ChevronRight: () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
    ),
    ChevronLeft: () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
    ),
    Flag: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-8a2 2 0 012-2h10a2 2 0 012 2v8m0-8a2 2 0 00-2-2H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
    ),
    Grid: () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
    ),
    Trash: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    ),
    Eye: () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    ),
    Close: () => (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    CheckCircleSmall: () => (
        <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
    )
};

export default function ExamPreviewPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.id;

    const editorConfig = useMemo(() => ({
        readonly: false,
        toolbar: true,
        placeholder: 'Tulis jawaban esai Anda di sini...',
        height: 300,
        buttons: ['bold', 'italic', 'underline', 'strikethrough', '|', 'ul', 'ol', '|', 'font', 'fontsize', 'brush', 'paragraph', '|', 'image', 'table', 'link', '|', 'align', 'undo', 'redo', '|', 'hr', 'eraser', 'fullsize']
    }), []);

    const [examDetails, setExamDetails] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [doubtfulAnswers, setDoubtfulAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);

    useEffect(() => {
        if (!examId) return;

        async function getExamData() {
            try {
                setLoading(true);
                // We reuse the public questions API, but we need to ensure it works for admins in this context
                // Or we might need a specific preview API if the regular one has strict checks.
                // For now, let's try reading settings and questions.
                const [settingsRes, questionsRes] = await Promise.all([
                    fetch(`/api/exams/settings?exam_id=${examId}`),
                    fetch(`/api/exams/questions?exam_id=${examId}`),
                ]);

                if (!settingsRes.ok) throw new Error((await settingsRes.json()).message || 'Could not fetch exam settings.');
                if (!questionsRes.ok) throw new Error((await questionsRes.json()).message || 'Could not fetch questions.');

                const settingsData = await settingsRes.json();

                // Questions API might return different format for admin vs student (shuffled vs not)
                // Here we assume the standard format
                let questionsData = await questionsRes.json();

                // Normalize questions if needed (similar to student view)
                questionsData = questionsData.map(q => {
                    // If options are string, parse them
                    let opts = q.options;
                    if (typeof opts === 'string') {
                        try { opts = JSON.parse(opts); } catch (e) { }
                    }
                    // Convert object options to array structure used in student view if needed, 
                    // OR handle both formats. 
                    // The student view expects options as array: [{originalKey: 'A', text: '...'}, ...]
                    if (!Array.isArray(opts)) {
                        opts = Object.entries(opts || {}).map(([key, text]) => ({
                            originalKey: key,
                            text
                        }));
                    }
                    return { ...q, options: opts };
                });


                setExamDetails(settingsData);
                setQuestions(questionsData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        getExamData();
    }, [examId]);


    const handleAnswerSelect = (questionId, option) => {
        const qIndex = questions.findIndex(q => q.id === questionId);
        const qType = questions[qIndex].question_type || 'multiple_choice';

        let newAnswer;
        if (qType === 'multiple_choice_complex') {
            const currentAnswers = answers[questionId] ? String(answers[questionId]).split(',') : [];
            if (currentAnswers.includes(option)) {
                newAnswer = currentAnswers.filter(a => a !== option).sort().join(',');
            } else {
                newAnswer = [...currentAnswers, option].sort().join(',');
            }
        } else {
            newAnswer = option;
        }

        setAnswers((prev) => {
            if (!newAnswer) {
                const next = { ...prev };
                delete next[questionId];
                return next;
            }
            return { ...prev, [questionId]: newAnswer };
        });
    };

    const handleEssayChange = (questionId, text) => {
        setAnswers((prev) => ({ ...prev, [questionId]: text }));
    };

    const handleClearAnswer = (questionId) => {
        setAnswers((prev) => {
            const newAnswers = { ...prev };
            delete newAnswers[questionId];
            return newAnswers;
        });
    };

    const handleToggleDoubtful = (questionId) => {
        setDoubtfulAnswers(prev => ({ ...prev, [questionId]: !prev[questionId] }));
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrevQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex((prev) => prev - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleSelectQuestion = (index) => {
        setCurrentQuestionIndex(index);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const currentQuestion = questions[currentQuestionIndex];
    const progressPercentage = useMemo(() => {
        if (questions.length === 0) return 0;
        const answeredCount = Object.keys(answers).length;
        return Math.round((answeredCount / questions.length) * 100);
    }, [answers, questions.length]);

    if (loading) { return <div className="text-center p-20">Loading Preview...</div> }
    if (error) { return <div className="text-center p-20 text-red-500">Error: {error}</div> }


    const QuestionNavigation = ({ questions, answers, doubtful, currentIndex, onSelect }) => (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-32">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Navigasi Soal</h3>
                <span className="text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded text-slate-500">
                    Total: {questions.length}
                </span>
            </div>
            <div className="p-4">
                <div className="grid grid-cols-5 gap-2">
                    {questions.map((q, index) => {
                        const isAnswered = answers[q.id] !== undefined;
                        const isDoubtful = doubtful[q.id];
                        const isActive = index === currentIndex;
                        let buttonClass = 'h-10 w-full rounded-lg text-sm font-bold transition-all duration-200 relative ';
                        if (isActive) buttonClass += 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2';
                        else if (isDoubtful) buttonClass += 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200';
                        else if (isAnswered) buttonClass += 'bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200';
                        else buttonClass += 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:bg-slate-50';
                        return (
                            <button key={q.id} onClick={() => onSelect(index)} className={buttonClass}>
                                {index + 1}
                                {isDoubtful && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white"></span>)}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 pt-10">
            {/* Preview Banner */}
            <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white z-[60] shadow-md">
                <div className="max-w-7xl mx-auto px-4 h-10 flex items-center justify-between gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 font-bold text-sm md:text-base truncate">
                        <Icons.Eye />
                        <span className="hidden sm:inline">PREVIEW MODE - No answers will be saved</span>
                        <span className="sm:hidden">PREVIEW MODE</span>
                    </div>
                    <button 
                        onClick={() => router.back()} 
                        className="flex-shrink-0 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs md:text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
                    >
                        Tutup Preview
                    </button>
                </div>
            </div>

            <header className="bg-white border-b border-slate-200 sticky top-10 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => router.back()} className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <Icons.ArrowLeft />
                        </button>
                        <h1 className="text-sm md:text-lg font-bold text-slate-800 truncate">
                            {examDetails?.exam_name} <span className="hidden sm:inline text-slate-400 font-normal">(Preview)</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-2 font-mono px-2 md:px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200">
                            <Icons.Clock />
                            <span className="text-xs md:text-sm font-bold tracking-wider">--:--:--</span>
                        </div>
                        <button 
                            onClick={() => setIsSidebarVisible(!isSidebarVisible)} 
                            className="md:hidden p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors"
                        >
                            <Icons.Grid />
                        </button>
                    </div>
                </div>
                <div className="h-1 w-full bg-slate-100 md:hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-8 lg:col-span-9 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                            {currentQuestion ? (
                                <>
                                    <div className="p-6 md:p-8 flex-1">
                                        <div className="flex justify-between items-start mb-6">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">Soal No. {currentQuestionIndex + 1}</span>
                                            <button onClick={() => handleToggleDoubtful(currentQuestion.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${doubtfulAnswers[currentQuestion.id] ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                                                <Icons.Flag />
                                                {doubtfulAnswers[currentQuestion.id] ? 'Ditandai Ragu' : 'Tandai Ragu'}
                                            </button>
                                        </div>
                                        <div className="prose prose-slate max-w-none mb-8">
                                            <p className="text-lg md:text-xl font-medium text-slate-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: currentQuestion.question_text }} />
                                        </div>
                                        <div className="space-y-3">
                                            {currentQuestion.question_type === 'essay' ? (
                                                <div className="mt-4">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jawaban Esai Anda:</label>
                                                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                                        <JoditEditor
                                                            value={answers[currentQuestion.id] || ''}
                                                            config={editorConfig}
                                                            onBlur={(newContent) => handleEssayChange(currentQuestion.id, newContent)}
                                                        />
                                                    </div>
                                                    <p className="mt-2 text-xs text-slate-400 italic font-medium flex items-center gap-1.5">
                                                        <Icons.CheckCircleSmall /> Preview Mode - Konten editor dapat diinteraksi
                                                    </p>
                                                </div>
                                            ) : (
                                                currentQuestion.options && currentQuestion.options.map((option, idx) => {
                                                    const optionLabel = String.fromCharCode(65 + idx);
                                                    const isSelected = currentQuestion.question_type === 'multiple_choice_complex'
                                                        ? (answers[currentQuestion.id] ? String(answers[currentQuestion.id]).split(',').includes(option.originalKey) : false)
                                                        : answers[currentQuestion.id] === option.originalKey;

                                                    return (
                                                        <div key={option.originalKey} onClick={() => handleAnswerSelect(currentQuestion.id, option.originalKey)} className={`group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${isSelected ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>{optionLabel}</div>
                                                            <span className={`text-base font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`} dangerouslySetInnerHTML={{ __html: option.text }} />
                                                            {isSelected && (
                                                                <div className="absolute right-4 text-indigo-600">
                                                                    {currentQuestion.question_type === 'multiple_choice_complex' ? (
                                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    ) : (
                                                                        <Icons.CheckCircle />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 md:p-6 border-t border-slate-200 flex flex-col-reverse md:flex-row justify-between items-center gap-4">
                                        <button onClick={() => handleClearAnswer(currentQuestion.id)} disabled={!answers[currentQuestion.id]} className={`text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!answers[currentQuestion.id] ? 'opacity-0 pointer-events-none' : 'text-red-600 hover:bg-red-50'}`}>
                                            <Icons.Trash />
                                            Hapus Jawaban
                                        </button>
                                        <div className="flex w-full md:w-auto gap-3">
                                            <button onClick={handlePrevQuestion} disabled={currentQuestionIndex === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                                <Icons.ChevronLeft />
                                                Sebelumnya
                                            </button>
                                            {currentQuestionIndex === questions.length - 1 ? (
                                                <div className="relative">
                                                    <button onClick={() => alert('This is a preview. Submission is disabled.')} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-slate-400 rounded-xl cursor-not-allowed shadow-none">
                                                        <Icons.CheckCircle />
                                                        Selesai (Preview)
                                                    </button>                            </div>
                                            ) : (
                                                <button onClick={handleNextQuestion} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100">
                                                    Selanjutnya
                                                    <Icons.ChevronRight />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                !loading && <div className="flex-1 flex flex-col items-center justify-center text-center p-10"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400"><Icons.Flag /></div><h2 className="text-xl font-semibold text-slate-800">Tidak ada soal dimuat.</h2><p className="text-slate-500 mt-2">Tambahkan soal terlebih dahulu untuk melihat preview.</p></div>
                            )}
                        </div>
                    </div>
                    <div className="hidden md:block md:col-span-4 lg:col-span-3">
                        <QuestionNavigation questions={questions} answers={answers} doubtful={doubtfulAnswers} currentIndex={currentQuestionIndex} onSelect={handleSelectQuestion} />
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Drawer */}
            {isSidebarVisible && (
                <div className="md:hidden fixed inset-0 z-[100] flex justify-end">
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
                        onClick={() => setIsSidebarVisible(false)}
                    ></div>
                    <div className="relative w-80 max-w-[85%] h-full bg-white dark:bg-slate-800 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Navigasi Soal</h3>
                            <button 
                                onClick={() => setIsSidebarVisible(false)} 
                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                            >
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <QuestionNavigation 
                                questions={questions} 
                                answers={answers} 
                                doubtful={doubtfulAnswers} 
                                currentIndex={currentQuestionIndex} 
                                onSelect={(idx) => {
                                    handleSelectQuestion(idx);
                                    setIsSidebarVisible(false);
                                }} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
