'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Trash, 
  Save, 
  X, 
  Settings,
  Type,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { uploadBase64Images } from '@/app/lib/utils';
import { toast } from 'sonner';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

const Icons = {
  Upload: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
};

const JoditEditorWithUpload = ({ value, onBlur }) => {
    const editor = useRef(null);
    const config = useMemo(() => ({
        readonly: false,
        height: 'auto',
        minHeight: 150,
        insertImageAsBase64URL: true,
        buttons: 'bold,italic,underline,strikethrough,|,ul,ol,|,outdent,indent,|,font,fontsize,brush,paragraph,|,image,video,table,link,|,align,undo,redo,\n,cut,hr,eraser,copyformat,|,symbol,fullsize,print,about'
    }), []);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (editor.current) editor.current.selection.insertImage(e.target.result);
        };
        reader.readAsDataURL(file);
        event.target.value = null;
    };

    return (
        <div className="relative">
            <JoditEditor
                ref={editor}
                value={value}
                config={config}
                onBlur={newContent => onBlur(newContent)}
            />
            <div className="mt-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border-2 border-slate-100 dark:border-slate-700 transition-all active:scale-95">
                    <Icons.Upload /> UPLOAD GAMBAR
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                </label>
            </div>
        </div>
    );
};

export default function BankQuestionForm({ folderId, initialData, onSave, onCancel }) {
    const [questionText, setQuestionText] = useState(initialData?.question_text || '');
    
    // Parse options
    const parsedInitialOptions = useMemo(() => {
        if (!initialData?.options || initialData?.question_type === 'matching') return [
            { id: 1, key: 'A', value: '' },
            { id: 2, key: 'B', value: '' }
        ];
        const opts = typeof initialData.options === 'string' ? JSON.parse(initialData.options) : initialData.options;
        return Object.entries(opts).map(([key, value], idx) => ({ id: idx + 1, key, value }));
    }, [initialData]);

    const parsedInitialPairs = useMemo(() => {
        if (initialData?.question_type !== 'matching' || !initialData?.options) return [
            { id: 1, p: '', r: '' },
            { id: 2, p: '', r: '' }
        ];
        const opts = typeof initialData.options === 'string' ? JSON.parse(initialData.options) : initialData.options;
        return opts.pairs || [
            { id: 1, p: '', r: '' },
            { id: 2, p: '', r: '' }
        ];
    }, [initialData]);

    const [options, setOptions] = useState(parsedInitialOptions);
    const [pairs, setPairs] = useState(parsedInitialPairs);
    const [correctOption, setCorrectOption] = useState(initialData?.correct_option || 'A');
    const [questionType, setQuestionType] = useState(initialData?.question_type || 'multiple_choice');
    const [points, setPoints] = useState(initialData?.points || 1);
    const [scoringStrategy, setScoringStrategy] = useState(initialData?.scoring_strategy || (initialData?.question_type === 'essay' ? 'essay_manual' : 'standard'));
    const [correctOptions, setCorrectOptions] = useState(() => {
        if (initialData?.question_type === 'multiple_choice_complex' && initialData.correct_option) {
            return initialData.correct_option.split(',');
        }
        return [initialData?.correct_option || 'A'];
    });
    const [keywords, setKeywords] = useState(() => {
        try {
            const meta = typeof initialData?.scoring_metadata === 'string' ? JSON.parse(initialData.scoring_metadata) : (initialData?.scoring_metadata || {});
            return (meta.keywords || []).join(', ');
        } catch (e) { return ''; }
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const nextOptionId = useRef(options.length + 1);
    const nextPairId = useRef(pairs.length + 1);

    const handleOptionChange = (id, value) => {
        setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, value } : opt));
    };

    const handlePairChange = (id, field, value) => {
        setPairs(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const addPair = () => {
        setPairs(prev => [...prev, { id: nextPairId.current++, p: '', r: '' }]);
    };

    const removePair = (id) => {
        setPairs(prev => prev.filter(p => p.id !== id));
    };

    const addOption = () => {
        setOptions(prev => {
            const nextKey = String.fromCharCode(65 + prev.length);
            return [...prev, { id: nextOptionId.current++, key: nextKey, value: '' }];
        });
    };

    const removeOption = (id) => {
        const optionToRemove = options.find(opt => opt.id === id);
        if (optionToRemove) {
            if (correctOption === optionToRemove.key) setCorrectOption(options[0].key);
            setCorrectOptions(prev => prev.filter(k => k !== optionToRemove.key));
        }
        setOptions(prev => prev.filter(opt => opt.id !== id));
    };

    const handleTypeChange = (type) => {
        setQuestionType(type);
        setScoringStrategy(type === 'essay' ? 'essay_manual' : 'standard');
        if (type === 'true_false') {
            setOptions([
                { id: 1, key: 'A', value: 'Benar' },
                { id: 2, key: 'B', value: 'Salah' },
            ]);
            setCorrectOption('A');
        } else if (type === 'essay') {
            setOptions([]);
        } else if (type === 'matching') {
            setOptions([]);
            if (pairs.length === 0) {
                setPairs([
                    { id: 1, p: '', r: '' },
                    { id: 2, p: '', r: '' }
                ]);
            }
        } else if (type === 'multiple_choice_complex' && scoringStrategy === 'standard') {
            setScoringStrategy('pgk_partial');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation logic
        const isMatchingEmpty = questionType === 'matching' && pairs.some(p => !p.p.trim() || !p.r.trim());
        const isOptionsEmpty = questionType !== 'essay' && questionType !== 'matching' && options.some(o => !o.value.trim());

        if (!questionText.trim() || isMatchingEmpty || isOptionsEmpty) {
            setError('Mohon lengkapi pertanyaan dan semua opsi/pasangan.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const processedQuestionText = await uploadBase64Images(questionText);
            const processedOptions = await Promise.all(
                options.map(async (opt) => ({
                    ...opt,
                    value: await uploadBase64Images(opt.value),
                }))
            );

            const processedPairs = await Promise.all(
                pairs.map(async (pair) => ({
                    ...pair,
                    p: await uploadBase64Images(pair.p),
                    r: await uploadBase64Images(pair.r),
                }))
            );

            let optionsForApi = {};
            if (questionType === 'matching') {
                optionsForApi = { pairs: processedPairs };
            } else {
                optionsForApi = processedOptions.reduce((acc, opt) => {
                    acc[opt.key] = opt.value;
                    return acc;
                }, {});
            }

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? correctOptions.sort().join(',') 
                : correctOption;

            const payload = {
                id: initialData?.id,
                folder_id: folderId,
                question_text: processedQuestionText,
                options: optionsForApi,
                correct_option: finalCorrectOption,
                question_type: questionType,
                points,
                scoring_strategy: scoringStrategy,
                scoring_metadata: questionType === 'essay' ? { keywords: keywords.split(',').map(k => k.trim()).filter(k => k) } : null
            };

            const res = await fetch('/api/bank/questions', {
                method: initialData ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Soal berhasil disimpan ke bank');
                onSave();
            } else {
                throw new Error('Gagal menyimpan ke bank');
            }
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-10">
            {/* Metadata Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-3">
                        <Type className="w-5 h-5 text-indigo-500" />
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Metadata Soal</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Tipe Soal</label>
                            <select 
                                value={questionType} 
                                onChange={(e) => handleTypeChange(e.target.value)}
                                className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 transition-all font-bold text-slate-700 dark:text-slate-100 outline-none focus:border-indigo-400"
                            >
                                <option value="multiple_choice">Pilihan Ganda</option>
                                <option value="multiple_choice_complex">Pilihan Ganda Kompleks</option>
                                <option value="true_false">Benar / Salah</option>
                                <option value="matching">Menjodohkan (Matching)</option>
                                <option value="essay">Esai</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Poin Dasar</label>
                            <input 
                                type="number" 
                                step="any"
                                value={points}
                                onChange={(e) => setPoints(parseFloat(e.target.value))}
                                className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 transition-all font-bold text-slate-700 dark:text-slate-100 outline-none focus:border-indigo-400"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white flex flex-col justify-center relative shadow-2xl shadow-indigo-200 dark:shadow-none overflow-hidden group">
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700"></div>
                    <div className="relative">
                        <p className="text-xs font-black opacity-60 uppercase tracking-widest mb-1">Status Bank</p>
                        <div className="text-3xl font-black">{folderId ? 'Penyimpanan Ready' : 'Global (Root)'}</div>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/20 inline-flex px-3 py-1 rounded-full">
                           <Save className="w-3 h-3" /> Auto Draft Disimpan
                        </div>
                    </div>
                </div>
            </div>

            {/* Question Content */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Konten Pertanyaan</h3>
                </div>
                <JoditEditorWithUpload 
                    value={questionText}
                    onBlur={newContent => setQuestionText(newContent)}
                />
            </div>

            {/* Scoring Strategies Section */}
            {(questionType === 'multiple_choice_complex' || questionType === 'essay') && (
                <div className={`p-8 rounded-[2.5rem] border-2 shadow-sm animate-in fade-in duration-500 ${questionType === 'essay' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50' : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50'}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <Settings className={`w-5 h-5 ${questionType === 'essay' ? 'text-emerald-500' : 'text-indigo-500'}`} />
                        <h3 className={`text-sm font-black uppercase tracking-widest ${questionType === 'essay' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                            {questionType === 'essay' ? 'Automasi Koreksi Esai' : 'Strategi PGK'}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {questionType === 'multiple_choice_complex' ? (
                            ['pgk_partial', 'pgk_strict', 'pgk_any', 'pgk_additive'].map(s => (
                                <button type="button" key={s} onClick={() => setScoringStrategy(s)} className={`p-4 rounded-3xl border-2 text-left transition-all ${scoringStrategy === s ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-xl scale-105 active:scale-95' : 'bg-white/40 dark:bg-slate-900/20 border-transparent hover:border-slate-200'}`}>
                                    <p className="font-black text-xs uppercase tracking-widest mb-1 text-slate-400">{s.split('_')[1]}</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{s.replace(/_/g, ' ')}</p>
                                </button>
                            ))
                        ) : (
                            ['essay_manual', 'essay_keywords', 'essay_any_keyword', 'essay_strict_keywords'].map(s => (
                                <button type="button" key={s} onClick={() => setScoringStrategy(s)} className={`p-4 rounded-3xl border-2 text-left transition-all ${scoringStrategy === s ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-xl scale-105 active:scale-95' : 'bg-white/40 dark:bg-slate-900/20 border-transparent hover:border-slate-200'}`}>
                                    <p className="font-black text-xs uppercase tracking-widest mb-1 text-slate-400">{s.split('_')[1]}</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{s.replace(/_/g, ' ')}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Options Section */}
            {questionType !== 'essay' && questionType !== 'matching' && (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Plus className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Pilihan Jawaban</h3>
                        </div>
                        {questionType !== 'true_false' && (
                            <button type="button" onClick={addOption} className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shadow-sm active:scale-90">
                                Tambah Opsi
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        {options.map((opt) => (
                           <div key={opt.id} className="relative group/opt">
                              <div className="absolute -left-4 top-4 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black z-10 shadow-lg shadow-indigo-200">
                                 {opt.key}
                              </div>
                              <div className="pl-10">
                                 <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border-2 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all">
                                    <div className="flex justify-between mb-4">
                                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Isi Jawaban {opt.key}</span>
                                       {options.length > 2 && questionType !== 'true_false' && (
                                          <button type="button" onClick={() => removeOption(opt.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                             <Trash className="w-4 h-4" />
                                          </button>
                                       )}
                                    </div>
                                    {questionType === 'true_false' ? (
                                       <input type="text" readOnly value={opt.value} className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl border-none font-bold text-slate-400" />
                                    ) : (
                                       <JoditEditorWithUpload value={opt.value} onBlur={newContent => handleOptionChange(opt.id, newContent)} />
                                    )}
                                 </div>
                              </div>
                           </div>
                        ))}
                    </div>

                    {/* Correct Answers */}
                    <div className="pt-8 border-t border-slate-50 dark:border-slate-700">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-6 ml-1">Kunci Jawaban</label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            {options.map(opt => {
                                const isSelected = questionType === 'multiple_choice_complex' 
                                    ? correctOptions.includes(opt.key) 
                                    : correctOption === opt.key;
                                
                                return (
                                    <button 
                                        type="button" 
                                        key={opt.id}
                                        onClick={() => {
                                            if (questionType === 'multiple_choice_complex') {
                                                if (correctOptions.includes(opt.key)) setCorrectOptions(correctOptions.filter(k => k !== opt.key));
                                                else setCorrectOptions([...correctOptions, opt.key]);
                                            } else {
                                                setCorrectOption(opt.key);
                                            }
                                        }}
                                        className={`flex flex-col items-center gap-2 p-6 rounded-3xl border-2 transition-all ${isSelected ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 shadow-xl' : 'bg-slate-50 dark:bg-slate-900 border-transparent hover:bg-slate-100'}`}
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${isSelected ? 'bg-emerald-500 text-white animate-in zoom-in-75 duration-300' : 'bg-white dark:bg-slate-800 text-slate-300'}`}>
                                            {isSelected ? <CheckCircle2 className="w-6 h-6" /> : opt.key}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>OPSI {opt.key}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Matching Section */}
            {questionType === 'matching' && (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Plus className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Daftar Pasangan (Matching)</h3>
                        </div>
                        <button type="button" onClick={addPair} className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shadow-sm active:scale-90">
                            Tambah Pasangan
                        </button>
                    </div>

                    <div className="space-y-6">
                        {pairs.map((pair, idx) => (
                            <div key={pair.id} className="relative group/pair">
                                <div className="absolute -left-4 top-4 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black z-10 shadow-lg">
                                    {idx + 1}
                                </div>
                                <div className="pl-10">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border-2 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all">
                                        <div className="flex justify-between items-center mb-6">
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pasangan #{idx+1}</span>
                                            {pairs.length > 1 && (
                                                <button type="button" onClick={() => removePair(pair.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Sisi Kiri (Premis)</label>
                                                <JoditEditorWithUpload value={pair.p} onBlur={newContent => handlePairChange(pair.id, 'p', newContent)} />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Sisi Kanan (Respon)</label>
                                                <JoditEditorWithUpload value={pair.r} onBlur={newContent => handlePairChange(pair.id, 'r', newContent)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {error && <div className="p-6 bg-red-50 dark:bg-red-950/20 border-2 border-red-100 dark:border-red-900/50 rounded-3xl text-red-600 font-bold flex items-center gap-3 animate-pulse">
                <AlertCircle className="w-5 h-5" /> {error}
            </div>}

            {/* Actions */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 bg-opacity-80 backdrop-blur-md p-8 border-t border-slate-50 dark:border-slate-800 flex justify-end gap-4 z-20 rounded-b-[2.5rem]">
                <button 
                    type="button" 
                    onClick={onCancel}
                    className="px-10 py-4 text-sm font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                    Batal
                </button>
                <button 
                   type="submit"
                   disabled={loading}
                   className="px-12 py-4 bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3"
                >
                    {loading ? 'Menyimpan...' : (
                        <>
                           <Save className="w-5 h-5" /> SIMPAN KE BANK
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
