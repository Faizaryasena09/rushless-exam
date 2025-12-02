'use client';

import { useState, useEffect } from 'react';
import UserModal from '../../components/UserModal';

const ManageUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

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
        headers: {
          'Content-Type': 'application/json',
        },
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
          headers: {
            'Content-Type': 'application/json',
          },
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
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <p className="text-gray-500">A list of all the users in your account including their name, title, email and role.</p>
        </div>
        <button onClick={handleAddUser} className="bg-blue-500 text-white p-2 rounded">
          Add User
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class ID</th>
              <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="py-4 px-6 whitespace-nowrap">{user.id}</td>
                <td className="py-4 px-6 whitespace-nowrap">{user.username}</td>
                <td className="py-4 px-6 whitespace-nowrap">{user.role}</td>
                <td className="py-4 px-6 whitespace-nowrap">{user.class_id}</td>
                <td className="py-4 px-6 whitespace-nowrap text-right">
                  <button onClick={() => handleEditUser(user)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                  <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900 ml-4">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <UserModal user={selectedUser} onClose={handleCloseModal} onSave={handleSaveUser} />
      )}
    </div>
  );
};

export default ManageUsersPage;
