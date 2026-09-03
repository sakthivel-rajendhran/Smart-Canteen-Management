import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Folder, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError('');
      // Admin might want to see both active and inactive, but getCategories only fetches active by default.
      // For this project, getCategories is simple. We can retrieve categories.
      const response = await API.get('/categories');
      if (response.data?.success) {
        setCategories(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch categories.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setSuccess('');
    setError('');

    try {
      const response = await API.post('/categories', { name: newCategory.trim() });
      if (response.data?.success) {
        setSuccess('Category added successfully! ✨');
        setNewCategory('');
        fetchCategories();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create category.');
    }
  };

  const deleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category? This might affect menu items associated with it.')) return;
    try {
      const response = await API.delete(`/categories/${id}`);
      if (response.data?.success) {
        setCategories((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete category.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-20">
      <h1 className="font-outfit font-black text-3xl text-primary-dark mb-8 flex items-center gap-2">
        <Folder className="w-8 h-8 text-primary" /> Category Management
      </h1>

      {success && (
        <div className="flex items-center gap-2 bg-primary-light border border-primary/20 text-primary-dark text-xs p-4 rounded-2xl mb-6 font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-2xl mb-6 font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Create Category Form */}
        <div className="bg-white border border-border p-6 rounded-3xl shadow-sm">
          <h2 className="font-outfit font-bold text-base text-primary-dark mb-5 border-b border-border pb-3 flex items-center gap-1">
            <Plus className="w-5 h-5 text-primary" /> Create Category
          </h2>
          <form onSubmit={handleAddCategory} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 font-outfit">Category Name</label>
              <input
                type="text"
                required
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Ex: Breakfast"
                className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-primary-dark hover:bg-primary text-white font-bold py-3 rounded-xl transition-all shadow-md text-xs"
            >
              Add Category
            </button>
          </form>
        </div>

        {/* Categories List Table */}
        <div className="md:col-span-2 bg-white border border-border p-6 rounded-3xl shadow-sm">
          <h2 className="font-outfit font-bold text-base text-primary-dark mb-5 border-b border-border pb-3">
            Active Categories List
          </h2>

          {loading ? (
            <div className="py-12 text-center text-xs text-muted">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">No categories created yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {categories.map((cat) => (
                <div 
                  key={cat._id}
                  className="flex items-center justify-between bg-cream border border-border/40 px-5 py-3.5 rounded-2xl text-xs font-semibold text-primary-dark"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📁</span>
                    <span className="font-bold">{cat.name}</span>
                  </div>
                  <button 
                    onClick={() => deleteCategory(cat._id)}
                    className="text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-xl transition-all border border-transparent hover:border-red-200"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Categories;
