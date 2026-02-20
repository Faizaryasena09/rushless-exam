'use client';

import Link from 'next/link';
import { ChevronLeft, Coffee, Github, Instagram, Heart } from 'lucide-react';

export default function SupportPage() {
    const links = [
        {
            name: 'Saweria',
            description: 'Support the developer via Saweria',
            descriptionId: 'Dukung pengembang via Saweria',
            url: 'https://saweria.co/Arsens009',
            icon: Coffee,
            color: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border-yellow-200',
        },
        {
            name: 'Instagram',
            description: 'Follow me on Instagram',
            descriptionId: 'Ikuti saya di Instagram',
            url: 'https://instagram.com/faizaryasena',
            icon: Instagram,
            color: 'bg-pink-50 text-pink-600 hover:bg-pink-100 border-pink-200',
        },
        {
            name: 'GitHub',
            description: 'Check out the code on GitHub',
            descriptionId: 'Lihat kode di GitHub',
            url: 'https://github.com/Faizaryasena09',
            icon: Github,
            color: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200',
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Navigation Bar */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="font-medium">Back to Home</span>
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center p-3 bg-indigo-100 text-indigo-600 rounded-full mb-4">
                        <Heart className="w-8 h-8 fill-current" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Support & Connect</h1>
                    <p className="text-slate-500 max-w-lg mx-auto">
                        Enjoying Rushless Exam? Support its development or connect with the creator through these channels.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {links.map((link) => {
                        const Icon = link.icon;
                        return (
                            <a
                                key={link.name}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex flex-col items-center justify-center p-8 rounded-2xl border transition-all transform hover:-translate-y-1 hover:shadow-lg ${link.color}`}
                            >
                                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                                    <Icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">{link.name}</h3>
                                <p className="text-sm text-center opacity-90">{link.description}</p>
                                <p className="text-xs text-center mt-1 opacity-75">({link.descriptionId})</p>
                            </a>
                        );
                    })}
                </div>

                <div className="mt-16 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Need Technical Help?</h3>
                    <p className="text-slate-500 mb-6">
                        If you encounter any bugs or issues, please report them to the school administration or submit an issue on GitHub.
                    </p>
                    <a
                        href="https://github.com/Faizaryasena09"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 transition-all"
                    >
                        <Github className="w-4 h-4" />
                        <span>Visit GitHub Repository</span>
                    </a>
                </div>
            </main>

            <footer className="py-8 text-center text-slate-500 text-sm">
                &copy; {new Date().getFullYear()} Rushless Exam. All rights reserved.
            </footer>
        </div>
    );
}
