'use client';

import { useState, useEffect } from 'react';

// --- Icons Component (Inline SVG) ---
const Icons = {
  Add: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Subject: () => (
    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  Close: () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
};

const ManageSubjectsPage = () => {
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectName, setSubjectName] = useState('');

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/subjects');
      if (!res.ok) {
        throw new Error('Failed to fetch subjects');
      }
      const data = await res.json();
      setSubjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddSubject = () => {
    setSelectedSubject(null);
    setSubjectName('');
    setIsModalOpen(true);
  };

  const handleEditSubject = (s) => {
    setSelectedSubject(s);
    setSubjectName(s.name);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveSubject = async (e) => {
    e.preventDefault(); // Prevent form submission refresh
    const method = selectedSubject ? 'PUT' : 'POST';
    const url = '/api/subjects';
    const body = selectedSubject ? { id: selectedSubject.id, name: subjectName } : { name: subjectName };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save subject');
      }

      setIsModalOpen(false);
      fetchSubjects();
    } catch (err) {
      alert(err.message); // Simple alert for modal error
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (window.confirm('Are you sure you want to delete this subject?')) {
      try {
        const res = await fetch(`/api/subjects?id=${subjectId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to delete subject');
        }

        fetchSubjects();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium text-center">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* --- Page Header --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manage Subjects (Mapel)</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
            Create and manage subjects that can be assigned to teachers and exams.
          </p>
        </div>
        <button 
          onClick={handleAddSubject} 
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/30"
        >
          <Icons.Add />
          <span>Add Subject</span>
        </button>
      </div>

      {/* --- Content Area --- */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="mt-2 text-slate-400 text-sm">Loading subjects...</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3">
            <Icons.Subject />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No subjects found</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Get started by creating a new subject.</p>
        </div>
      ) : (
        <div className="w-full">
          
          {/* --- DESKTOP VIEW (Table) --- */}
          <div className="hidden md:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50/80 dark:bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subject Name</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {subjects.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">#{s.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                          <Icons.Subject />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditSubject(s)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors text-xs font-medium"
                        >
                          <Icons.Edit /> Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteSubject(s.id)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors text-xs font-medium"
                        >
                          <Icons.Trash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- MOBILE VIEW (Cards) --- */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {subjects.map((s) => (
              <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-none">
                      <span className="text-xs font-bold">ID:{s.id}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg">{s.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Subject (Mapel)</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                   <button 
                     onClick={() => handleEditSubject(s)}
                     className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-colors"
                   >
                     <Icons.Edit /> Edit
                   </button>
                   <button 
                     onClick={() => handleDeleteSubject(s.id)}
                     className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors"
                   >
                     <Icons.Trash /> Delete
                   </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* --- Enhanced Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={handleCloseModal}
          ></div>

          {/* Modal Content */}
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedSubject ? 'Edit Subject' : 'New Subject'}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <Icons.Close />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSubject}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="e.g. Matematika"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 dark:shadow-none transition-colors disabled:opacity-50"
                  disabled={!subjectName.trim()}
                >
                  {selectedSubject ? 'Save Changes' : 'Create Subject'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default ManageSubjectsPage;
