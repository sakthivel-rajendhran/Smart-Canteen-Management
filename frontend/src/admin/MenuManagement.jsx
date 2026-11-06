import React, { useEffect, useState, useMemo, useRef } from 'react';
import API from '../services/api';
import {
  Utensils,
  Plus,
  Trash2,
  Edit,
  AlertCircle,
  IndianRupee,
  Camera,
  CheckCircle2,
  X,
  Search,
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  Clock,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Check,
} from 'lucide-react';

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active View Tab: 'table' or 'gallery'
  const [activeTab, setActiveTab] = useState('table');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // 'all', 'available', 'sold_out'
  const [featuredFilter, setFeaturedFilter] = useState('all'); // 'all', 'featured', 'standard'
  const [imageFilter, setImageFilter] = useState('all'); // 'all', 'with_image', 'missing_image'

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [quickImageItem, setQuickImageItem] = useState(null);

  // Form states for Add / Edit
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPreparationTime, setFormPreparationTime] = useState(10);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formAvailable, setFormAvailable] = useState(true);
  const [formImageFile, setFormImageFile] = useState(null);
  const [formImagePreview, setFormImagePreview] = useState(null);
  const [formRemoveImage, setFormRemoveImage] = useState(false);
  const [formValidationMsg, setFormValidationMsg] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  // Drag & drop highlight state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [menuRes, catRes] = await Promise.all([
        API.get('/menu'),
        API.get('/categories'),
      ]);

      if (menuRes.data?.success && catRes.data?.success) {
        setMenuItems(menuRes.data.data);
        setCategories(catRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch menu items.');
    } finally {
      setLoading(false);
    }
  };

  // Image statistics calculations
  const stats = useMemo(() => {
    const total = menuItems.length;
    const withImages = menuItems.filter((i) => {
      const url = i.image?.url || (typeof i.image === 'string' ? i.image : '');
      return Boolean(url && url.trim().length > 0);
    }).length;
    const missingImages = total - withImages;
    const available = menuItems.filter((i) => i.available !== false).length;
    const soldOut = total - available;
    const featured = menuItems.filter((i) => Boolean(i.featured)).length;

    return { total, withImages, missingImages, available, soldOut, featured };
  }, [menuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Search
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.category?.name && item.category.name.toLowerCase().includes(q));

      // Category
      const matchesCategory =
        selectedCategory === 'all' || item.category?._id === selectedCategory;

      // Availability
      const isAvail = item.available !== false;
      const matchesAvail =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && isAvail) ||
        (availabilityFilter === 'sold_out' && !isAvail);

      // Featured
      const matchesFeatured =
        featuredFilter === 'all' ||
        (featuredFilter === 'featured' && Boolean(item.featured)) ||
        (featuredFilter === 'standard' && !item.featured);

      // Image status
      const hasImage = Boolean(
        item.image?.url || (typeof item.image === 'string' && item.image.trim())
      );
      const matchesImage =
        imageFilter === 'all' ||
        (imageFilter === 'with_image' && hasImage) ||
        (imageFilter === 'missing_image' && !hasImage);

      return matchesSearch && matchesCategory && matchesAvail && matchesFeatured && matchesImage;
    });
  }, [menuItems, searchTerm, selectedCategory, availabilityFilter, featuredFilter, imageFilter]);

  // Image validation helper
  const validateAndProcessFile = (file) => {
    setFormValidationMsg('');
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFormValidationMsg('Invalid file format. Please upload a JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setFormValidationMsg(`Image size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 5 MB.`);
      return;
    }

    setFormRemoveImage(false);
    setFormImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCategory(categories.length > 0 ? categories[0]._id : '');
    setFormPrice('');
    setFormDescription('');
    setFormPreparationTime(10);
    setFormFeatured(false);
    setFormAvailable(true);
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormRemoveImage(false);
    setUploadProgressText('');
    setFormValidationMsg('');
  };

  const openAddModal = () => {
    resetForm();
    if (categories.length > 0) {
      setFormCategory(categories[0]._id);
    }
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category?._id || item.category || '');
    setFormPrice(item.price);
    setFormDescription(item.description || '');
    setFormPreparationTime(item.preparationTime || 10);
    setFormFeatured(Boolean(item.featured));
    setFormAvailable(item.available !== false);
    setFormImageFile(null);
    setFormRemoveImage(false);
    setUploadProgressText('');
    setFormImagePreview(item.image?.url || (typeof item.image === 'string' ? item.image : '') || null);
    setFormValidationMsg('');
  };

  // Submit Add Food
  const handleAddFood = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setFormValidationMsg('');
    setFormLoading(true);
    setUploadProgressText(formImageFile ? 'Uploading food image to Cloudinary...' : 'Saving food details...');

    try {
      const formData = new FormData();
      formData.append('name', formName);
      formData.append('category', formCategory);
      formData.append('price', formPrice);
      formData.append('description', formDescription);
      formData.append('preparationTime', formPreparationTime);
      formData.append('featured', formFeatured);
      formData.append('available', formAvailable);

      if (formImageFile) {
        formData.append('image', formImageFile);
      }

      const response = await API.post('/menu', formData);
      if (response.data?.success) {
        setSuccess(`✓ Food added successfully! "${formName}" with Cloudinary image is now active on the menu.`);
        setIsAddModalOpen(false);
        resetForm();
        fetchData();
      }
    } catch (err) {
      setFormValidationMsg(err.response?.data?.message || 'Failed to create food item.');
    } finally {
      setFormLoading(false);
      setUploadProgressText('');
    }
  };

  // Submit Edit Food
  const handleEditFood = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setSuccess('');
    setError('');
    setFormValidationMsg('');
    setFormLoading(true);
    setUploadProgressText(formImageFile ? 'Uploading replacement image to Cloudinary...' : 'Updating menu item...');

    try {
      const formData = new FormData();
      formData.append('name', formName);
      formData.append('category', formCategory);
      formData.append('price', formPrice);
      formData.append('description', formDescription);
      formData.append('preparationTime', formPreparationTime);
      formData.append('featured', formFeatured);
      formData.append('available', formAvailable);

      if (formImageFile) {
        formData.append('image', formImageFile);
      } else if (formRemoveImage) {
        formData.append('removeImage', 'true');
      }

      const response = await API.put(`/menu/${editingItem._id}`, formData);
      if (response.data?.success) {
        setSuccess(`✓ Food updated successfully! "${formName}" details and image have been updated.`);
        setEditingItem(null);
        resetForm();
        fetchData();
      }
    } catch (err) {
      setFormValidationMsg(err.response?.data?.message || 'Failed to update food item.');
    } finally {
      setFormLoading(false);
      setUploadProgressText('');
    }
  };

  // Quick Image Upload modal submit
  const handleQuickImageUpload = async (e) => {
    e.preventDefault();
    if (!quickImageItem || !formImageFile) return;
    setSuccess('');
    setError('');
    setFormLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', formImageFile);

      const response = await API.post(`/menu/${quickImageItem._id}/image`, formData);
      if (response.data?.success) {
        setSuccess(`✓ Food image updated successfully for "${quickImageItem.name}".`);
        setQuickImageItem(null);
        resetForm();
        fetchData();
      }
    } catch (err) {
      setFormValidationMsg(err.response?.data?.message || 'Failed to upload food image.');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete image from food item
  const handleDeleteImage = async (item) => {
    if (!confirm(`Remove image from "${item.name}"? A fallback icon will be shown.`)) return;
    try {
      const response = await API.delete(`/menu/${item._id}/image`);
      if (response.data?.success) {
        setSuccess(`✓ Food image removed successfully.`);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove image.');
    }
  };

  // Toggle availability
  const handleToggleAvailability = async (id) => {
    try {
      const response = await API.patch(`/menu/${id}/availability`);
      if (response.data?.success) {
        setMenuItems((prev) =>
          prev.map((item) =>
            item._id === id ? { ...item, available: response.data.data.available } : item
          )
        );
      }
    } catch (err) {
      alert('Failed to toggle availability status.');
    }
  };

  // Confirm delete food
  const confirmDeleteFood = async () => {
    if (!deletingItem) return;
    try {
      const response = await API.delete(`/menu/${deletingItem._id}`);
      if (response.data?.success) {
        setSuccess(`✓ Food removed successfully! "${deletingItem.name}" has been deleted.`);
        setMenuItems((prev) => prev.filter((i) => i._id !== deletingItem._id));
        setDeletingItem(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete item.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-28 font-inter text-text">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary/10 border border-primary/25 text-primary text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              Canteen Admin Hub
            </span>
            <span className="text-[10px] text-muted font-bold font-mono">
              Live Cloudinary Sync
            </span>
          </div>
          <h1 className="font-outfit font-black text-3xl md:text-4xl text-primary-dark tracking-tight flex items-center gap-2">
            <Utensils className="w-9 h-9 text-primary" /> Menu Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-3 bg-white hover:bg-gray-50 border border-border rounded-2xl text-muted hover:text-primary-dark transition-all shadow-sm"
            title="Refresh menu items"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openAddModal}
            className="bg-primary-dark hover:bg-primary text-white font-outfit font-bold text-sm px-6 py-3 rounded-2xl transition-all shadow-md shadow-primary-dark/20 flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Add New Food
          </button>
        </div>
      </div>

      {/* Success & Error Global Alerts */}
      {success && (
        <div className="flex items-center justify-between bg-primary-light border border-primary/20 text-primary-dark text-xs p-4 rounded-2xl mb-6 font-semibold shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-primary" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-primary hover:text-primary-dark">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-2xl mb-6 font-semibold shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Missing Images Warning Banner */}
      {stats.missingImages > 0 && (
        <div className="bg-amber-light/70 border border-amber/40 p-4.5 rounded-2xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber text-primary-darker rounded-xl flex items-center justify-center flex-shrink-0 font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-outfit font-bold text-primary-dark text-sm">
                ⚠ {stats.missingImages} menu item{stats.missingImages > 1 ? 's need' : ' needs'} images
              </h4>
              <p className="text-muted text-xs">
                Dishes with attractive photography get over 4x more orders from students.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setImageFilter('missing_image');
                setActiveTab('gallery');
              }}
              className="bg-amber hover:bg-amber-dark text-primary-darker font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" /> Manage Missing Images
            </button>
          </div>
        </div>
      )}

      {/* Section 29: Admin Dashboard Image Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-8">
        {[
          { label: 'Total Dishes', val: stats.total, color: 'text-primary-dark', bg: 'bg-white' },
          { label: 'With Images', val: `${stats.withImages}`, color: 'text-green-600', bg: 'bg-green-50/50' },
          { label: 'Missing Images', val: stats.missingImages, color: stats.missingImages > 0 ? 'text-amber-dark' : 'text-gray-400', bg: stats.missingImages > 0 ? 'bg-amber-50/50' : 'bg-white' },
          { label: 'Available', val: stats.available, color: 'text-primary', bg: 'bg-white' },
          { label: 'Sold Out', val: stats.soldOut, color: 'text-red-600', bg: 'bg-red-50/40' },
          { label: 'Featured', val: stats.featured, color: 'text-amber-dark', bg: 'bg-amber-50/30' },
        ].map((s, idx) => (
          <div
            key={idx}
            className={`border border-border/80 p-4 rounded-2xl shadow-sm ${s.bg} flex flex-col justify-between`}
          >
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
              {s.label}
            </span>
            <span className={`font-outfit font-black text-2xl ${s.color}`}>
              {s.val}
            </span>
          </div>
        ))}
      </div>

      {/* View Switcher & Search / Filters Bar */}
      <div className="bg-white border border-border p-4 md:p-5 rounded-3xl shadow-sm mb-8 flex flex-col gap-4">
        {/* Row 1: Search & Tab Switcher */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search food by name, description, category..."
              className="w-full bg-cream border border-border focus:border-primary rounded-xl py-2.5 pl-10 pr-8 text-xs focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-cream p-1 rounded-2xl border border-border self-start md:self-auto">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'table'
                  ? 'bg-primary-dark text-white shadow-sm'
                  : 'text-muted hover:text-primary-dark'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'gallery'
                  ? 'bg-primary-dark text-white shadow-sm'
                  : 'text-muted hover:text-primary-dark'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Image Grid Hub</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filter Selects */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 text-xs">
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted tracking-wider mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-cream border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted tracking-wider mb-1">
              Availability
            </label>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="w-full bg-cream border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="available">🟢 Available Only</option>
              <option value="sold_out">🔴 Sold Out Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted tracking-wider mb-1">
              Featured
            </label>
            <select
              value={featuredFilter}
              onChange={(e) => setFeaturedFilter(e.target.value)}
              className="w-full bg-cream border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary"
            >
              <option value="all">All Types</option>
              <option value="featured">⭐ Featured Only</option>
              <option value="standard">Standard Dishes</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted tracking-wider mb-1">
              Image Status
            </label>
            <select
              value={imageFilter}
              onChange={(e) => setImageFilter(e.target.value)}
              className="w-full bg-cream border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary"
            >
              <option value="all">All Dishes</option>
              <option value="with_image">✓ Has Real Image</option>
              <option value="missing_image">⚠ Missing Image</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Gallery */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <span className="text-muted text-sm font-bold uppercase tracking-wider">
            Loading canteen menu items...
          </span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-border rounded-3xl p-12 text-center shadow-sm">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-outfit font-bold text-lg text-primary-dark mb-1">
            No Menu Items Found
          </h3>
          <p className="text-muted text-xs mb-4">
            No dishes match your active search and filter criteria.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setAvailabilityFilter('all');
              setFeaturedFilter('all');
              setImageFilter('all');
            }}
            className="text-primary font-bold text-xs underline"
          >
            Reset Filters
          </button>
        </div>
      ) : activeTab === 'table' ? (
        /* Section 16: Menu Table View */
        <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-cream border-b border-border text-muted font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">Food Item</th>
                  <th className="py-4 px-4">Category</th>
                  <th className="py-4 px-4 text-center">Price</th>
                  <th className="py-4 px-4 text-center">Prep Time</th>
                  <th className="py-4 px-4 text-center">Availability</th>
                  <th className="py-4 px-4 text-center">Featured</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold">
                {filteredItems.map((item) => {
                  const isAvail = item.available !== false;
                  const imageUrl = item.image?.url || (typeof item.image === 'string' ? item.image : '') || '';

                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-cream/40 transition-all ${!isAvail ? 'opacity-70' : ''}`}
                    >
                      {/* Image & Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-cream group">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-2xl"
                                style={{ backgroundColor: item.backgroundColor || '#fff8eb' }}
                              >
                                {item.emoji || '🍛'}
                              </div>
                            )}
                            {/* Overlay button to replace image quickly */}
                            <button
                              onClick={() => {
                                setQuickImageItem(item);
                                setFormImageFile(null);
                                setFormImagePreview(imageUrl || null);
                                setFormValidationMsg('');
                              }}
                              className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              title="Update Image"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <span className="font-bold text-primary-dark block leading-snug">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-muted block leading-none font-medium truncate max-w-[240px] mt-0.5">
                              {item.description || 'No description provided.'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="bg-primary-light text-primary-dark font-bold rounded-full px-3 py-1 text-[10px]">
                          {item.category?.name || 'Canteen'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-center font-outfit font-black text-sm text-primary-dark">
                        ₹{item.price}
                      </td>

                      {/* Prep Time */}
                      <td className="py-3.5 px-4 text-center text-muted font-bold">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary" /> {item.preparationTime || 10}m
                        </span>
                      </td>

                      {/* Availability Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleAvailability(item._id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            isAvail
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAvail ? 'bg-green-600 animate-pulse' : 'bg-red-600'
                            }`}
                          />
                          <span>{isAvail ? 'Available' : 'Sold Out'}</span>
                        </button>
                      </td>

                      {/* Featured */}
                      <td className="py-3.5 px-4 text-center">
                        {item.featured ? (
                          <span className="inline-flex items-center gap-1 bg-amber/20 text-primary-darker px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                            <Sparkles className="w-3 h-3 text-amber fill-amber" /> Yes
                          </span>
                        ) : (
                          <span className="text-gray-300 text-[10px] font-bold">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setQuickImageItem(item);
                              setFormImageFile(null);
                              setFormImagePreview(imageUrl || null);
                              setFormValidationMsg('');
                            }}
                            className="p-2 bg-cream hover:bg-amber-light text-primary-dark rounded-xl transition-all"
                            title="Manage Image"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 bg-cream hover:bg-primary-light text-primary-dark rounded-xl transition-all"
                            title="Edit Item"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingItem(item)}
                            className="p-2 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-xl transition-all"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Section 30: Food Image Management Gallery Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => {
            const imageUrl = item.image?.url || (typeof item.image === 'string' ? item.image : '') || '';
            const hasImage = Boolean(imageUrl && imageUrl.trim().length > 0);

            return (
              <div
                key={item._id}
                className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-all"
              >
                {/* 4:3 Image Container */}
                <div className="relative aspect-[4/3] bg-cream overflow-hidden">
                  {hasImage ? (
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
                      style={{ backgroundColor: item.backgroundColor || '#fff8eb' }}
                    >
                      <span className="text-5xl mb-1">{item.emoji || '🍛'}</span>
                      <span className="text-[10px] font-bold text-red-600 uppercase bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                        ⚠ Missing Image
                      </span>
                    </div>
                  )}

                  {/* Status Indicator Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {hasImage ? (
                      <span className="bg-green-600/90 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-sm">
                        <Check className="w-3 h-3" /> Image Active
                      </span>
                    ) : (
                      <span className="bg-amber text-primary-darker font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
                        Needs Photo
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-outfit font-bold text-sm text-primary-dark line-clamp-1">
                      {item.name}
                    </h4>
                    <span className="font-outfit font-black text-sm text-primary-dark">
                      ₹{item.price}
                    </span>
                  </div>

                  <span className="text-[10px] text-muted mb-4">
                    {item.category?.name || 'Canteen'}
                  </span>

                  {/* Actions Row */}
                  <div className="mt-auto flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setQuickImageItem(item);
                        setFormImageFile(null);
                        setFormImagePreview(imageUrl || null);
                        setFormValidationMsg('');
                      }}
                      className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{hasImage ? 'Replace Image' : 'Upload Image'}</span>
                    </button>
                    {hasImage && (
                      <button
                        onClick={() => handleDeleteImage(item)}
                        className="p-2 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 rounded-xl transition-all"
                        title="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* 1. Add New Food Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-border max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-outfit font-black text-xl text-primary-dark flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Add New Food Item
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFood} className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {formValidationMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formValidationMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Food Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Masala Dosa"
                  className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Category *
                  </label>
                  <select
                    required
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                  >
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="50"
                    className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Crispy dosa served with piping hot sambar and chutney..."
                  className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2 px-3.5 text-xs focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formPreparationTime}
                    onChange={(e) => setFormPreparationTime(e.target.value)}
                    className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 bg-cream rounded-xl border border-border cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={formFeatured}
                      onChange={(e) => setFormFeatured(e.target.checked)}
                      className="accent-primary w-4 h-4 rounded"
                    />
                    <span className="text-xs font-bold text-primary-dark">Featured</span>
                  </label>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 bg-cream rounded-xl border border-border cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={formAvailable}
                      onChange={(e) => setFormAvailable(e.target.checked)}
                      className="accent-primary w-4 h-4 rounded"
                    />
                    <span className="text-xs font-bold text-primary-dark">Available</span>
                  </label>
                </div>
              </div>

              {/* Section 7: Food Image (Cloudinary Upload) */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Food Image</span>
                  <span className="text-primary font-semibold">Automatic Cloudinary Storage</span>
                </label>
                {formImagePreview ? (
                  /* Preview Box */
                  <div className="relative border-2 border-dashed border-primary/40 rounded-2xl p-4 bg-primary-light/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-border shadow-inner flex-shrink-0 bg-white">
                        <img
                          src={formImagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-primary-dark block truncate">
                          {formImageFile ? formImageFile.name : 'Selected Food Image'}
                        </span>
                        <span className="text-[10px] text-muted block mt-0.5">
                          {formImageFile ? `${(formImageFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to Upload` : 'Stored image'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-primary hover:underline px-2 py-1"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormImageFile(null);
                          setFormImagePreview(null);
                        }}
                        className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Drag and Drop Container */
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-primary bg-primary-light/40 scale-102'
                        : 'border-border bg-cream/70 hover:border-primary/50 hover:bg-cream'
                    }`}
                  >
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm border border-border/60 text-primary">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-primary-dark block mb-0.5">
                      Upload Food Image
                    </span>
                    <span className="text-[11px] text-muted block mb-1">
                      Drag & Drop or <span className="text-primary font-bold underline">Browse from Device</span>
                    </span>
                    <span className="text-[10px] text-gray-400 block font-mono">
                      JPG, JPEG, PNG, WEBP • Max 5 MB
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      validateAndProcessFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Upload Progress Indicator */}
              {formLoading && (
                <div className="bg-primary-light/30 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-xs text-primary-dark font-semibold">
                    {uploadProgressText || 'Uploading to Cloudinary & saving to database...'}
                  </span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full bg-primary-dark hover:bg-primary text-white font-outfit font-bold text-sm py-3.5 rounded-xl transition-all shadow-md active:scale-98 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {formLoading ? 'Uploading & Creating...' : 'Add Food to Canteen Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Food Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-border max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-outfit font-black text-xl text-primary-dark flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" /> Edit Food: {editingItem.name}
              </h2>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditFood} className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {formValidationMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formValidationMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Food Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                  >
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2 px-3.5 text-xs focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formPreparationTime}
                    onChange={(e) => setFormPreparationTime(e.target.value)}
                    className="w-full bg-cream border border-border focus:border-primary focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 bg-cream rounded-xl border border-border cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={formFeatured}
                      onChange={(e) => setFormFeatured(e.target.checked)}
                      className="accent-primary w-4 h-4 rounded"
                    />
                    <span className="text-xs font-bold text-primary-dark">Featured</span>
                  </label>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 bg-cream rounded-xl border border-border cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={formAvailable}
                      onChange={(e) => setFormAvailable(e.target.checked)}
                      className="accent-primary w-4 h-4 rounded"
                    />
                    <span className="text-xs font-bold text-primary-dark">Available</span>
                  </label>
                </div>
              </div>

              {/* Replace / Remove Image Box */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Food Image</span>
                  <span className="text-primary font-semibold">Cloudinary Storage</span>
                </label>
                {formImagePreview ? (
                  <div className="relative border-2 border-dashed border-primary/40 rounded-2xl p-4 bg-primary-light/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-border shadow-inner flex-shrink-0 bg-white">
                        <img
                          src={formImagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-primary-dark block truncate">
                          {formImageFile ? formImageFile.name : (editingItem.image?.url ? 'Current Cloudinary Image' : 'Selected Image')}
                        </span>
                        <span className="text-[10px] text-muted block mt-0.5">
                          {formImageFile ? `${(formImageFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to Upload` : 'Stored in database'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-primary hover:underline px-2 py-1"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormImageFile(null);
                          setFormImagePreview(null);
                          setFormRemoveImage(true);
                        }}
                        className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer border-border bg-cream/70 hover:border-primary/50"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mx-auto mb-2 text-primary border border-border/60">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-primary-dark block">
                      Upload New Image
                    </span>
                    <span className="text-[11px] text-muted block mb-1">
                      Drag & Drop or <span className="text-primary font-bold underline">Browse from Device</span>
                    </span>
                    <span className="text-[10px] text-gray-400 block font-mono">
                      JPG, JPEG, PNG, WEBP • Max 5 MB
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      validateAndProcessFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Upload Progress Indicator */}
              {formLoading && (
                <div className="bg-primary-light/30 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-xs text-primary-dark font-semibold">
                    {uploadProgressText || 'Updating Cloudinary asset & saving changes...'}
                  </span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full bg-primary-dark hover:bg-primary text-white font-outfit font-bold text-sm py-3.5 rounded-xl transition-all shadow-md active:scale-98 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {formLoading ? 'Saving Changes...' : 'Save Food Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Quick Image Upload / Replace Modal */}
      {quickImageItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-border p-6 flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="font-outfit font-bold text-base text-primary-dark flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" /> Image for "{quickImageItem.name}"
              </h3>
              <button
                onClick={() => setQuickImageItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickImageUpload} className="flex flex-col gap-4">
              {formValidationMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-semibold">
                  {formValidationMsg}
                </div>
              )}

              {formImagePreview ? (
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-cream">
                  <img src={formImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 flex flex-col justify-between p-3.5">
                    <span className="text-white text-xs font-bold truncate">
                      {formImageFile ? formImageFile.name : 'Current Image'}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-white/90 text-[10px] font-medium">
                        {formImageFile ? `${(formImageFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Stored in database'}
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white/90 hover:bg-white text-primary-dark text-xs font-bold px-3 py-1 rounded-lg shadow-sm"
                      >
                        Choose Another
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-primary/40 rounded-2xl p-8 text-center bg-cream/70 hover:bg-cream cursor-pointer"
                >
                  <Camera className="w-8 h-8 text-primary mx-auto mb-2" />
                  <span className="text-xs font-bold text-primary-dark block mb-1">
                    Upload Food Photography
                  </span>
                  <span className="text-[10px] text-muted block font-mono">
                    Drag & Drop or Browse • Max 5MB
                  </span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    validateAndProcessFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickImageItem(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-muted font-bold text-xs py-3 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formImageFile || formLoading}
                  className="flex-1 bg-primary-dark hover:bg-primary text-white font-bold text-xs py-3 rounded-xl disabled:bg-gray-300 shadow-md"
                >
                  {formLoading ? 'Uploading...' : 'Save to Cloudinary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Section 18: Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-border p-6 text-center"
          >
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="font-outfit font-black text-xl text-primary-dark mb-2">
              Delete Food?
            </h3>
            <p className="text-muted text-xs leading-relaxed mb-6">
              Are you sure you want to delete <span className="font-bold text-primary-dark">"{deletingItem.name}"</span>?
              <br />
              This action cannot be undone.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeletingItem(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFood}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
