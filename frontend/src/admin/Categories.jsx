import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import MenuCacheService from '../services/menuCache';
import { useSocket } from '../context/SocketContext';
import CategoryIcon from '../components/common/CategoryIcon';
import {
  CATEGORY_ICON_PRESETS,
  validateAndCleanSvgClient,
  getCategoryIconSvg,
} from '../utils/categoryIcons';
import {
  Folder,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
  Power,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Check,
} from 'lucide-react';

const Categories = () => {
  const { socket } = useSocket();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  // Add / Edit Category Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formName, setFormName] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formIconSvg, setFormIconSvg] = useState('');
  const [iconReplaced, setIconReplaced] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const svgFileInputRef = useRef(null);

  // Delete Confirmation / Protection Modal State
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  // Keep list & item counts synchronized across sessions
  useEffect(() => {
    if (!socket) return;

    const handleCategoryCreated = (cat) => {
      MenuCacheService.clear();
      setCategories((prev) => {
        if (prev.some((c) => c._id === cat._id)) return prev;
        return [...prev, cat].sort((a, b) => a.name.localeCompare(b.name));
      });
    };

    const handleCategoryUpdated = (updatedCat) => {
      MenuCacheService.clear();
      setCategories((prev) =>
        prev
          .map((c) => (c._id === updatedCat._id ? updatedCat : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    };

    const handleCategoryDeleted = ({ id }) => {
      MenuCacheService.clear();
      setCategories((prev) => prev.filter((c) => c._id !== id));
    };

    const handleMenuChanged = () => {
      fetchCategories(true);
    };

    socket.on('category:created', handleCategoryCreated);
    socket.on('category:updated', handleCategoryUpdated);
    socket.on('category:deleted', handleCategoryDeleted);
    socket.on('menu:created', handleMenuChanged);
    socket.on('menu:updated', handleMenuChanged);
    socket.on('menu:deleted', handleMenuChanged);

    return () => {
      socket.off('category:created', handleCategoryCreated);
      socket.off('category:updated', handleCategoryUpdated);
      socket.off('category:deleted', handleCategoryDeleted);
      socket.off('menu:created', handleMenuChanged);
      socket.off('menu:updated', handleMenuChanged);
      socket.off('menu:deleted', handleMenuChanged);
    };
  }, [socket]);

  const fetchCategories = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const response = await API.get('/categories?all=true');
      if (response.data?.success) {
        setCategories(response.data.data || []);
      }
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || 'Failed to fetch categories.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Summary counts
  const counts = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.active !== false).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (statusFilter === 'active') return categories.filter((c) => c.active !== false);
    if (statusFilter === 'inactive') return categories.filter((c) => c.active === false);
    return categories;
  }, [categories, statusFilter]);

  // Open Modal for Creating New Category
  const openAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormActive(true);
    setFormIconSvg(CATEGORY_ICON_PRESETS[0].svg);
    setIconReplaced(true);
    setUploadedFileName('');
    setModalError('');
    setIsFormModalOpen(true);
  };

  // Open Modal for Editing / Renaming Existing Category
  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name || '');
    setFormActive(cat.active !== false);
    setFormIconSvg(cat.icon || '');
    setIconReplaced(false);
    setUploadedFileName('');
    setModalError('');
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    if (submitting) return;
    setIsFormModalOpen(false);
    setEditingCategory(null);
    setModalError('');
  };

  // Select Preset SVG Icon
  const handleSelectPresetIcon = (presetSvg) => {
    setFormIconSvg(presetSvg);
    setIconReplaced(true);
    setUploadedFileName('');
    setModalError('');
  };

  // Preserve original icon when editing
  const handleKeepOriginalIcon = () => {
    if (!editingCategory) return;
    setFormIconSvg(editingCategory.icon || '');
    setIconReplaced(false);
    setUploadedFileName('');
    setModalError('');
    if (svgFileInputRef.current) svgFileInputRef.current.value = '';
  };

  // Upload & Validate Custom .SVG File
  const handleSvgFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isSvgMime =
      file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if (!isSvgMime) {
      setModalError('Invalid file format. Only .svg vector files are allowed for category icons.');
      e.target.value = '';
      return;
    }

    if (file.size > 60 * 1024) {
      setModalError('SVG file is too large. Please upload an SVG icon under 60 KB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const validation = validateAndCleanSvgClient(text);
      if (!validation.valid) {
        setModalError(validation.message || 'Invalid SVG markup.');
        return;
      }
      setFormIconSvg(validation.svg);
      setIconReplaced(true);
      setUploadedFileName(file.name);
      setModalError('');
    };
    reader.onerror = () => {
      setModalError('Failed to read the selected SVG file.');
    };
    reader.readAsText(file);
  };

  // Submit Create or Edit Category
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setModalError('Category name is required.');
      return;
    }

    setSubmitting(true);
    setModalError('');
    setError('');
    setSuccess('');

    try {
      if (editingCategory) {
        const payload = {
          name: cleanName,
          active: formActive,
        };
        // Only transmit icon when a new replacement icon was chosen
        if (iconReplaced) {
          payload.icon = formIconSvg;
        }

        const response = await API.put(`/categories/${editingCategory._id}`, payload);
        if (response.data?.success) {
          const updated = response.data.data;
          setCategories((prev) =>
            prev
              .map((c) => (c._id === updated._id ? updated : c))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
          MenuCacheService.clear();
          setSuccess(`Category updated to "${updated.name}" successfully.`);
          setIsFormModalOpen(false);
          setEditingCategory(null);
        }
      } else {
        const payload = {
          name: cleanName,
          active: formActive,
          icon: formIconSvg || CATEGORY_ICON_PRESETS[0].svg,
        };

        const response = await API.post('/categories', payload);
        if (response.data?.success) {
          const created = response.data.data;
          setCategories((prev) =>
            [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
          );
          MenuCacheService.clear();
          setSuccess(`Category "${created.name}" created and saved to database.`);
          setIsFormModalOpen(false);
        }
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Activate / Deactivate Category Toggle
  const handleToggleStatus = async (cat) => {
    const nextActive = cat.active === false;
    setTogglingId(cat._id);
    setError('');
    setSuccess('');

    try {
      const response = await API.put(`/categories/${cat._id}`, {
        active: nextActive,
      });
      if (response.data?.success) {
        const updated = response.data.data;
        setCategories((prev) =>
          prev.map((c) => (c._id === updated._id ? updated : c))
        );
        MenuCacheService.clear();
        setSuccess(
          `Category "${updated.name}" marked as ${updated.active !== false ? 'Active' : 'Inactive'}.`
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update category status.');
    } finally {
      setTogglingId(null);
    }
  };

  // Open Delete Dialog
  const openDeleteModal = (cat) => {
    setDeletingCategory(cat);
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeletingCategory(null);
    setDeleteError('');
  };

  // Confirm Deletion (only when no food items are assigned)
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setDeleteLoading(true);
    setDeleteError('');
    setError('');
    setSuccess('');

    try {
      const response = await API.delete(`/categories/${deletingCategory._id}`);
      if (response.data?.success) {
        const removedName = deletingCategory.name;
        setCategories((prev) => prev.filter((c) => c._id !== deletingCategory._id));
        MenuCacheService.clear();
        setSuccess(`Category "${removedName}" deleted successfully.`);
        setDeletingCategory(null);
      }
    } catch (err) {
      setDeleteError(
        err.response?.data?.message || 'Failed to delete category.'
      );
      // Sync categories if server reported assigned items
      if (err.response?.data?.assignedCount !== undefined) {
        fetchCategories(true);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // Quick fallback inside Delete Blocked modal: deactivate instead of deleting
  const handleDeactivateFromDeleteModal = async () => {
    if (!deletingCategory) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const response = await API.put(`/categories/${deletingCategory._id}`, {
        active: false,
      });
      if (response.data?.success) {
        const updated = response.data.data;
        setCategories((prev) =>
          prev.map((c) => (c._id === updated._id ? updated : c))
        );
        MenuCacheService.clear();
        setSuccess(
          `"${updated.name}" deactivated safely. All ${updated.itemCount || 0} food item(s) remain intact.`
        );
        setDeletingCategory(null);
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to deactivate category.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const previewSvg = editingCategory && !iconReplaced
    ? getCategoryIconSvg(editingCategory)
    : formIconSvg || CATEGORY_ICON_PRESETS[0].svg;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div>
          <h1 className="font-outfit font-black text-3xl text-primary-dark flex items-center gap-2.5">
            <Folder className="w-8 h-8 text-primary shrink-0" />
            <span>Category Management</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Add, rename, customize SVG icons, activate/deactivate, or safely manage menu food categories in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 bg-primary-dark hover:bg-primary text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {success && (
        <div className="flex items-center justify-between gap-2 bg-primary-light border border-primary/20 text-primary-dark text-xs p-4 rounded-2xl mb-6 font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-primary" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="text-primary-dark/60 hover:text-primary-dark"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-2xl mb-6 font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-800"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Summary Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex items-center bg-white border border-border rounded-2xl p-1 gap-1 shadow-xs">
          {[
            { key: 'all', label: `All Categories (${counts.total})` },
            { key: 'active', label: `Active (${counts.active})` },
            { key: 'inactive', label: `Inactive (${counts.inactive})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-primary-dark text-white shadow-xs'
                  : 'text-muted hover:text-primary-dark hover:bg-cream'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-semibold text-muted">
          Food items remain linked by database ID when categories are renamed.
        </span>
      </div>

      {/* Main Categories List Card */}
      <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-cream/40">
          <h2 className="font-outfit font-bold text-base text-primary-dark">
            Active Categories List
          </h2>
          <span className="text-[11px] font-bold text-muted">
            Showing {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-muted font-medium">
            Loading categories...
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-primary-dark mb-1">
              No categories found
            </p>
            <p className="text-xs text-muted mb-5">
              {statusFilter === 'all'
                ? 'Click "Add Category" to create your first food category.'
                : `No ${statusFilter} categories right now.`}
            </p>
            {statusFilter === 'all' && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 bg-primary-dark text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary transition-all"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-cream/60 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                    <th className="py-3.5 px-6 w-24">Icon</th>
                    <th className="py-3.5 px-4">Category Name</th>
                    <th className="py-3.5 px-4 w-44">Status</th>
                    <th className="py-3.5 px-6 text-right w-72">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {filteredCategories.map((cat) => {
                    const isActive = cat.active !== false;
                    const itemCount = cat.itemCount || 0;

                    return (
                      <tr
                        key={cat._id}
                        className={`transition-colors hover:bg-cream/50 ${
                          !isActive ? 'bg-gray-50/70' : ''
                        }`}
                      >
                        {/* Icon */}
                        <td className="py-4 px-6">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                              isActive
                                ? 'bg-primary-light/40 border-primary/20 text-primary-dark'
                                : 'bg-gray-100 border-gray-200 text-gray-400'
                            }`}
                          >
                            <CategoryIcon category={cat} className="w-5 h-5" />
                          </div>
                        </td>

                        {/* Category Name */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`font-outfit font-bold text-sm ${
                                isActive ? 'text-primary-dark' : 'text-gray-500'
                              }`}
                            >
                              {cat.name}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream border border-border text-muted">
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </td>

                        {/* Status + Quick Toggle */}
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            disabled={togglingId === cat._id}
                            onClick={() => handleToggleStatus(cat)}
                            title={
                              isActive
                                ? 'Click to deactivate category'
                                : 'Click to activate category'
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-60 ${
                              isActive
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                            <span>{isActive ? 'Active' : 'Inactive'}</span>
                            <Power className="w-3 h-3 ml-0.5 opacity-70" />
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(cat)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cream hover:bg-primary-light text-primary-dark border border-border hover:border-primary/30 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit / Rename</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openDeleteModal(cat)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50/70 hover:bg-red-600 hover:text-white border border-red-200/80 transition-all cursor-pointer"
                              title={
                                itemCount > 0
                                  ? `Cannot delete (${itemCount} food items assigned)`
                                  : 'Delete Category'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-border">
              {filteredCategories.map((cat) => {
                const isActive = cat.active !== false;
                const itemCount = cat.itemCount || 0;

                return (
                  <div
                    key={cat._id}
                    className={`p-4 flex flex-col gap-3 ${!isActive ? 'bg-gray-50/80' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-primary-light/40 border-primary/20 text-primary-dark'
                              : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}
                        >
                          <CategoryIcon category={cat} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-outfit font-bold text-sm text-primary-dark truncate">
                            {cat.name}
                          </div>
                          <div className="text-[11px] text-muted font-semibold">
                            {itemCount} {itemCount === 1 ? 'food item' : 'food items'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={togglingId === cat._id}
                        onClick={() => handleToggleStatus(cat)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                          isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-cream text-primary-dark border border-border"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit / Rename</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteModal(cat)}
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ==================== ADD / EDIT CATEGORY MODAL ==================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center">
                  {editingCategory ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-outfit font-bold text-base text-primary-dark">
                    {editingCategory ? `Edit / Rename "${editingCategory.name}"` : 'Add New Category'}
                  </h3>
                  <p className="text-[11px] text-muted">
                    {editingCategory
                      ? 'Assigned food items stay linked automatically when renaming.'
                      : 'Create a new food category stored dynamically in MongoDB.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeFormModal}
                className="text-muted hover:text-primary-dark p-1.5 rounded-xl hover:bg-cream transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 flex flex-col gap-5">
              {modalError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-2xl font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Field 1: Category Name */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 font-outfit">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Food Items, Breakfast, Beverages"
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-sm font-semibold text-primary-dark focus:outline-none transition-all"
                />
              </div>

              {/* Field 2: Category Icon (SVG) */}
              <div className="bg-cream/60 border border-border rounded-2xl p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider font-outfit">
                      Category Icon (SVG)
                    </label>
                    <p className="text-[11px] text-muted mt-0.5">
                      {editingCategory && !iconReplaced
                        ? 'Current icon is preserved unless you select or upload a replacement.'
                        : uploadedFileName
                        ? `Uploaded SVG: ${uploadedFileName}`
                        : 'Select a preset SVG icon or upload a custom .svg file.'}
                    </p>
                  </div>

                  {/* Live Preview */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      title="Live Icon Preview"
                      className="w-11 h-11 rounded-2xl bg-primary-dark text-white flex items-center justify-center shadow-sm border border-primary/20"
                    >
                      <CategoryIcon svg={previewSvg} className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Preset SVG Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-primary-dark">
                      Preset Vector Icons
                    </span>
                    {editingCategory && iconReplaced && (
                      <button
                        type="button"
                        onClick={handleKeepOriginalIcon}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Keep Current Icon
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {CATEGORY_ICON_PRESETS.map((preset) => {
                      const isSelected =
                        (iconReplaced || !editingCategory) && formIconSvg === preset.svg;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPresetIcon(preset.svg)}
                          title={preset.label}
                          className={`relative flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary-light border-primary text-primary-dark shadow-xs'
                              : 'bg-white border-border text-muted hover:border-primary/40 hover:text-primary-dark'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-primary text-white rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                          <CategoryIcon svg={preset.svg} className="w-4.5 h-4.5" />
                          <span className="truncate w-full text-center px-0.5 text-[9px]">
                            {preset.label.split('/')[0].trim()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Upload Custom SVG Option */}
                <div className="pt-2 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted">
                    Or upload a custom SVG file (.svg, max 60 KB):
                  </span>
                  <label className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-primary-light text-primary-dark border border-border hover:border-primary/40 font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-all shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .SVG</span>
                    <input
                      ref={svgFileInputRef}
                      type="file"
                      accept=".svg,image/svg+xml"
                      onChange={handleSvgFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Field 3: Category Status */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 font-outfit">
                  Category Status
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormActive(true)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formActive
                        ? 'bg-green-50 border-green-500 text-green-800 shadow-xs'
                        : 'bg-cream border-border text-muted hover:border-gray-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Active</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormActive(false)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !formActive
                        ? 'bg-gray-100 border-gray-500 text-gray-800 shadow-xs'
                        : 'bg-cream border-border text-muted hover:border-gray-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>Inactive</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted mt-1.5">
                  Inactive categories are hidden from customer menus and new food creation, while preserving existing dishes.
                </p>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 rounded-xl border border-border text-xs font-bold text-muted hover:text-primary-dark hover:bg-cream transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-primary-dark hover:bg-primary text-white text-xs font-bold shadow-md transition-all disabled:opacity-60 cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : editingCategory
                    ? 'Save Changes'
                    : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION / PROTECTION MODAL ==================== */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-3xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            {(deletingCategory.itemCount || 0) > 0 ? (
              /* Protected State: Food items are assigned */
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-outfit font-bold text-base text-primary-dark">
                      Deletion Protected
                    </h3>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      Cannot delete <strong className="text-primary-dark">"{deletingCategory.name}"</strong> because{' '}
                      <strong className="text-primary-dark">
                        {deletingCategory.itemCount} food{' '}
                        {deletingCategory.itemCount === 1 ? 'item is' : 'items are'}
                      </strong>{' '}
                      currently assigned to it. Food records are never deleted automatically.
                    </p>
                  </div>
                </div>

                {deleteError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-semibold">
                    {deleteError}
                  </div>
                )}

                <div className="bg-cream border border-border rounded-2xl p-3.5 text-[11px] text-primary-dark space-y-1.5">
                  <p className="font-bold">How to proceed safely:</p>
                  <p className="text-muted">
                    • Reassign those dishes in <strong>Menu Management</strong> to another category first, OR
                  </p>
                  <p className="text-muted">
                    • <strong>Deactivate</strong> this category so customers cannot order from it while keeping all menu records intact.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  {deletingCategory.active !== false && (
                    <button
                      type="button"
                      disabled={deleteLoading}
                      onClick={handleDeactivateFromDeleteModal}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber text-primary-darker font-black text-xs hover:bg-amber-light transition-all cursor-pointer"
                    >
                      {deleteLoading ? 'Updating...' : `Deactivate "${deletingCategory.name}" Instead`}
                    </button>
                  )}

                  <Link
                    to="/admin/menu"
                    onClick={closeDeleteModal}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary-dark text-white font-bold text-xs hover:bg-primary transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    <span>Reassign Items in Menu Management</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="w-full py-2.5 px-4 rounded-xl border border-border text-xs font-bold text-muted hover:text-primary-dark hover:bg-cream transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Safe Delete State: 0 items assigned */
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-outfit font-bold text-base text-primary-dark">
                      Delete Category "{deletingCategory.name}"?
                    </h3>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      There are currently <strong>0 food items</strong> assigned to this category. Are you sure you want to permanently remove it?
                    </p>
                  </div>
                </div>

                {deleteError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-semibold">
                    {deleteError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={deleteLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-border text-xs font-bold text-muted hover:text-primary-dark hover:bg-cream transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
