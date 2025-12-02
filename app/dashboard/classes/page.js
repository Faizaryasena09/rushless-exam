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
  Class: () => (
    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Close: () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
};

const ManageClassesPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [className, setClassName] = useState('');

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/classes');
      if (!res.ok) {
        throw new Error('Failed to fetch classes');
      }
      const data = await res.json();
      setClasses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleAddClass = () => {
    setSelectedClass(null);
    setClassName('');
    setIsModalOpen(true);
  };

  const handleEditClass = (c) => {
    setSelectedClass(c);
    setClassName(c.class_name);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveClass = async (e) => {
    e.preventDefault(); // Prevent form submission refresh
    const method = selectedClass ? 'PUT' : 'POST';
    const url = '/api/classes';
    const body = selectedClass ? { id: selectedClass.id, className } : { className };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save class');
      }

      setIsModalOpen(false);
      fetchClasses();
    } catch (err) {
      alert(err.message); // Simple alert for modal error
    }
  };

  const handleDeleteClass = async (classId) => {
    if (window.confirm('Are you sure you want to delete this class?')) {
      try {
        const res = await fetch('/api/classes', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: classId }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to delete class');
        }

        fetchClasses();
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Classes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage class groups for exams.
          </p>
        </div>
        <button 
          onClick={handleAddClass} 
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200"
        >
          <Icons.Add />
          <span>Add Class</span>
        </button>
      </div>

      {/* --- Content Area --- */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="mt-2 text-slate-400 text-sm">Loading classes...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="mx-auto h-12 w-12 text-slate-300 mb-3">
            <Icons.Class />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No classes found</h3>
          <p className="text-slate-500 text-sm mt-1">Get started by creating a new class.</p>
        </div>
      ) : (
        <div className="w-full">
          
          {/* --- DESKTOP VIEW (Table) --- */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Class Name</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {classes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">#{c.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                          <Icons.Class />
                        </div>
                        <span className="font-semibold text-slate-900">{c.class_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditClass(c)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-xs font-medium"
                        >
                          <Icons.Edit /> Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteClass(c.id)} 
                          className="flex items-center gap-1 px-3 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors text-xs font-medium"
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
            {classes.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                      <span className="text-xs font-bold">ID:{c.id}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{c.class_name}</h3>
                      <p className="text-xs text-slate-500">Class Group</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                   <button 
                     onClick={() => handleEditClass(c)}
                     className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                   >
                     <Icons.Edit /> Edit
                   </button>
                   <button 
                     onClick={() => handleDeleteClass(c.id)}
                     className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
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
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">
                {selectedClass ? 'Edit Class' : 'New Class'}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Icons.Close />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveClass}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Class Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. XII Science 1"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors"
                >
                  {selectedClass ? 'Save Changes' : 'Create Class'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClassesPage;