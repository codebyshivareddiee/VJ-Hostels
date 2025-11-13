import React, { useState, useEffect } from 'react';
import axios from 'axios';
// import { useUser } from '../context/UserContext';
import { MessageSquare, Image, Send, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';

const CommunityPosts = () => {
    const { user } = useUser();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('general');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');

    // Fetch community posts
    useEffect(() => {
        fetchCommunityPosts();
    }, []);

    const fetchCommunityPosts = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/student-api/get-community-messages`);
            setPosts(response.data);
            setError('');
        } catch (err) {
            setError('Failed to load community posts');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Handle image selection
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);

            // Create a preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Cancel image selection
    const cancelImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
    };

    // Submit a new post
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!content.trim() && !selectedImage) {
            toast.error('Please enter some content or select an image');
            return;
        }

        setSubmitting(true);

        try {
            // Create form data for the post
            const formData = new FormData();
            formData.append('content', content.trim());
            formData.append('postedBy', JSON.stringify({
                rollNumber: user.rollNumber,
                name: user.name
            }));
            formData.append('category', category);

            // Add image if selected
            if (selectedImage) {
                formData.append('image', selectedImage);
            }

            // Create the post
            const response = await axios.post(
                `${import.meta.env.VITE_SERVER_URL}/student-api/post-community-message`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            // Add the new post to the list
            setPosts([response.data.post, ...posts]);

            // Clear form
            setContent('');
            setCategory('general');
            setSelectedImage(null);
            setImagePreview(null);

            toast.success('Post created successfully!');
        } catch (error) {
            setError('Failed to create post');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    // Filter posts based on search term and category
    const filteredPosts = posts.filter(post => {
        const matchesSearch =
            post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.postedBy.name.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = filter === 'all' || post.category === filter;

        return matchesSearch && matchesCategory;
    });

    // Get badge class based on category
    const getCategoryBadgeClass = (category) => {
        switch (category) {
            case 'general':
                return 'bg-primary';
            case 'missing item':
                return 'bg-warning';
            case 'interchanged clothes':
                return 'bg-info';
            default:
                return 'bg-secondary';
        }
    };

    return (
        <div className="community-posts-container">
            {/* Create Post Form */}
            <div className="community-posts-form">
                <div className="card mb-3">
                    <div className="card-header bg-light">
                        <h6 className="mb-0">Create a New Post</h6>
                    </div>
                    <div className="card-body p-3">
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <textarea
                                    className="form-control"
                                    placeholder="What's on your mind?"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows="3"
                                    disabled={submitting}
                                    style={{ fontSize: '1rem' }}
                                ></textarea>
                            </div>

                            {imagePreview && (
                                <div className="mb-3 position-relative">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="img-thumbnail"
                                        style={{ maxHeight: '150px' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger position-absolute top-0 end-0"
                                        onClick={cancelImage}
                                        style={{ transform: 'translate(50%, -50%)' }}
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}

                            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                                <div>
                                    <select
                                        className="form-select"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        disabled={submitting}
                                        style={{ fontSize: '1rem' }}
                                    >
                                        <option value="general">General</option>
                                        <option value="missing item">Missing Item</option>
                                        <option value="interchanged clothes">Interchanged Clothes</option>
                                    </select>
                                </div>
                                <div className="d-flex gap-2">
                                    <label className="btn btn-outline-secondary" htmlFor="image-upload">
                                        <Image size={18} />
                                        <span className="ms-2">Add Image</span>
                                    </label>
                                    <input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        style={{ display: 'none' }}
                                        disabled={submitting}
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={submitting || (!content.trim() && !selectedImage)}
                                    >
                                        {submitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Posting...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} className="me-2" />
                                                Post
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="community-posts-list">
                <div className="card mb-3">
                    <div className="card-header bg-light p-3">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <h5 className="mb-0">Community Posts</h5>
                            <div className="d-flex gap-2 w-100 w-md-auto">
                                <select
                                    className="form-select"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    style={{ fontSize: '1rem' }}
                                >
                                    <option value="all">All Categories</option>
                                    <option value="general">General</option>
                                    <option value="missing item">Missing Item</option>
                                    <option value="interchanged clothes">Interchanged Clothes</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="card-body p-3">
                        <div className="mb-3">
                            <div className="input-group">
                                <span className="input-group-text">
                                    <Search size={18} />
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by content or student name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ fontSize: '1rem' }}
                                />
                            </div>
                        </div>

                        {/* Posts List */}
                        <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
                            {loading ? (
                                <div className="text-center my-4">
                                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="alert alert-danger alert-sm" role="alert">
                                    {error}
                                </div>
                            ) : filteredPosts.length === 0 ? (
                                <div className="alert alert-info alert-sm" role="alert">
                                    No community posts found.
                                </div>
                            ) : (
                                <div className="list-group list-group-flush">
                                    {filteredPosts.map(post => (
                                        <div key={post._id} className="community-post-item">
                                            <div className="community-post-header">
                                                <div>
                                                    <div className="community-post-author">{post.postedBy.name}</div>
                                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>({post.postedBy.rollNumber})</span>
                                                </div>
                                                <div className="community-post-meta">
                                                    <span className={`badge ${getCategoryBadgeClass(post.category)}`} style={{ fontSize: '0.7rem' }}>
                                                        {post.category}
                                                    </span>
                                                    <small className="text-muted">
                                                        {new Date(post.createdAt).toLocaleString()}
                                                    </small>
                                                </div>
                                            </div>
                                            <div className="community-post-content">{post.content}</div>

                                            {post.images && post.images.length > 0 && (
                                                <div className="d-flex flex-wrap gap-2 mb-2">
                                                    {post.images.map((image, index) => (
                                                        <img
                                                            key={index}
                                                            src={image}
                                                            alt={`Post image ${index + 1}`}
                                                            className="img-thumbnail"
                                                            style={{
                                                                width: '120px',
                                                                height: '120px',
                                                                objectFit: 'cover',
                                                                cursor: 'pointer'
                                                            }}
                                                            onClick={() => window.open(image, '_blank')}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityPosts;
