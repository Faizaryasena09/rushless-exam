'use client';

import { useState, useEffect } from 'react';

const ManageClassesPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [className, setClassName] = useState('');

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      if (!res.ok) {
        throw new Error('Failed to fetch classes');
      }
      const data = await res.json();
      setClasses(data);
    } catch (err) {
      setError(err.message);
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

  const handleSaveClass = async () => {
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
      setError(err.message);
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
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Manage Classes</h1>
      <button onClick={handleAddClass} className="bg-blue-500 text-white p-2 rounded mb-4">
        Add Class
      </button>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">ID</th>
            <th className="py-2 px-4 border-b">Class Name</th>
            <th className="py-2 px-4 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id}>
              <td className="py-2 px-4 border-b">{c.id}</td>
              <td className="py-2 px-4 border-b">{c.class_name}</td>
              <td className="py-2 px-4 border-b">
                <button onClick={() => handleEditClass(c)} className="text-blue-500 hover:underline">Edit</button>
                <button onClick={() => handleDeleteClass(c.id)} className="text-red-500 hover:underline ml-4">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">{selectedClass ? 'Edit Class' : 'Add Class'}</h2>
            <div className="mb-4">
              <label className="block text-gray-700">Class Name</label>
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="bg-gray-500 text-white p-2 rounded mr-2"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button onClick={handleSaveClass} className="bg-blue-500 text-white p-2 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClassesPage;
