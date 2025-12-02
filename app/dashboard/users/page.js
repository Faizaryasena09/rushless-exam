'use client';

import { useState, useEffect } from 'react';
import UserModal from '../../components/UserModal';

// Icons Component
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
  User: () => (
    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Class: () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
};

const ManageUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClass) {
        params.append('classId', selectedClass);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      if (!res.ok) throw new Error('Failed to fetch classes');
      const data = await res.json();
      setAllClasses(data);
    } catch (err) {
      // Don't block user page if classes fail to load
      console.error(err.message);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500); // Debounce to avoid excessive API calls

    return () => clearTimeout(delayDebounceFn);
  }, [selectedClass, searchTerm]);

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };
  // ... (rest of the handler functions are the same)
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveUser = async (userData) => {
    const method = userData.id ? 'PUT' : 'POST';
    const url = '/api/users';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save user');
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const res = await fetch('/api/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: userId }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to delete user');
        }
        fetchUsers();
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
    <div className="space-y-6 pb-20"> {/* pb-20 agar tidak tertutup tombol fixed di hp jika ada */}
      
      {/* Header Section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {users.length} registered users
                </p>
            </div>
            <button 
              onClick={handleAddUser} 
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200"
            >
              <Icons.Add />
              <span>Add User</span>
            </button>
        </div>
        {/* Filter and Search Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200">
            <input 
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
                <option value="">All Classes</option>
                {allClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
            </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400 animate-pulse">Loading users...</div>
      ) : (
        <div className="w-full">
          {/* --- DESKTOP VIEW (Table) --- */}
          {/* Hidden di Mobile (hidden), Muncul di MD (block) */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">#{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <Icons.User />
                        </div>
                        <span className="font-semibold text-slate-900">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {user.class_name ? <span className="flex items-center gap-1"><Icons.Class />{user.class_name}</span> : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditUser(user)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Icons.Edit /></button>
                        <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- MOBILE VIEW (Cards) --- */}
          {/* Muncul di Mobile (grid), Hidden di MD (hidden) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {users.map((user) => (
              <div key={user.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col gap-4">
                
                {/* Header Card: User Info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <span className="text-lg font-bold">{user.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{user.username}</h3>
                      <p className="text-xs text-slate-500">ID: #{user.id}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                    user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {user.role}
                  </span>
                </div>

                {/* Body Card: Details */}
                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center border border-slate-100">
                   <div className="flex items-center gap-2 text-slate-600 text-sm">
                      <Icons.Class />
                      <span>Class:</span>
                   </div>
                   <span className="font-semibold text-slate-800">{user.class_name || 'None'}</span>
                </div>

                {/* Footer Card: Actions (Full Width Buttons) */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                   <button 
                     onClick={() => handleEditUser(user)}
                     className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                   >
                     <Icons.Edit /> Edit
                   </button>
                   <button 
                     onClick={() => handleDeleteUser(user.id)}
                     className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                   >
                     <Icons.Trash /> Delete
                   </button>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {isModalOpen && (
        <UserModal user={selectedUser} onClose={handleCloseModal} onSave={handleSaveUser} />
      )}
    </div>
  );
};

export default ManageUsersPage;