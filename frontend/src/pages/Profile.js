import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';

const Profile = () => {
  const { user, login } = useAuth();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [skillForm, setSkillForm] = useState({
    skill_name: '',
    skill_type: 'OFFER',
    description: '',
    proficiency_level: 'Beginner'
  });

  const fetchSkills = useCallback(async () => {
    if (!user) return;
    try {
      const response = await axios.get(`/api/skills/user/${user.id}`);
      setSkills(response.data);
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSkills();
    if (user?.profile_pic) {
      setProfilePicPreview(`${API_BASE_URL}${user.profile_pic}`);
    }
  }, [user, fetchSkills]);

  const handleSkillChange = (e) => {
    setSkillForm({ ...skillForm, [e.target.name]: e.target.value });
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/skills', skillForm);
      setSkillForm({ skill_name: '', skill_type: 'OFFER', description: '', proficiency_level: 'Beginner' });
      setShowAddSkill(false);
      await fetchSkills();
      // Notify dashboard to refresh matches
      window.dispatchEvent(new CustomEvent('skillsUpdated'));
      alert('Skill added successfully! Check the Dashboard for new matches.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add skill');
    }
  };

  const handleEditSkill = (skill) => {
    setEditingSkill(skill);
    setSkillForm({
      skill_name: skill.skill_name,
      skill_type: skill.skill_type,
      description: skill.description || '',
      proficiency_level: skill.proficiency_level || 'Beginner'
    });
    setShowAddSkill(true);
  };

  const handleUpdateSkill = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/skills/${editingSkill.id}`, skillForm);
      setEditingSkill(null);
      setSkillForm({ skill_name: '', skill_type: 'OFFER', description: '', proficiency_level: 'Beginner' });
      setShowAddSkill(false);
      await fetchSkills();
      // Notify dashboard to refresh matches
      window.dispatchEvent(new CustomEvent('skillsUpdated'));
      alert('Skill updated successfully! Check the Dashboard for new matches.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update skill');
    }
  };

  const handleDeleteSkill = async (skillId) => {
    if (!window.confirm('Are you sure you want to delete this skill?')) return;
    try {
      await axios.delete(`/api/skills/${skillId}`);
      await fetchSkills();
      // Notify dashboard to refresh matches
      window.dispatchEvent(new CustomEvent('skillsUpdated'));
      alert('Skill deleted successfully! Check the Dashboard for updated matches.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete skill');
    }
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Profile picture size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicPreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload the file
      const formData = new FormData();
      formData.append('profile_pic', file);
      
      axios.post('/api/upload/profile-pic', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then(response => {
        // Update user context with new profile pic
        const updatedUser = { ...user, profile_pic: response.data.profile_pic };
        login(localStorage.getItem('token'), updatedUser);
        alert('Profile picture updated successfully!');
      }).catch(error => {
        alert(error.response?.data?.error || 'Failed to upload profile picture');
        // Revert preview
        if (user?.profile_pic) {
          setProfilePicPreview(`${API_BASE_URL}${user.profile_pic}`);
        } else {
          setProfilePicPreview(null);
        }
      });
    }
  };

  const getInitials = (name) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.username?.charAt(0).toUpperCase() || '?';
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  const offerSkills = skills.filter(s => s.skill_type === 'OFFER');
  const wantSkills = skills.filter(s => s.skill_type === 'WANT');

  return (
    <div className="container">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your skills and profile information</p>
      </div>

      <div className="grid-2">
        {/* Profile Info */}
        <div className="card">
          <div className="profile-pic-container" style={{ marginBottom: '30px' }}>
            {profilePicPreview ? (
              <img src={profilePicPreview} alt="Profile" className="profile-pic-preview" />
            ) : (
              <div className="profile-pic-placeholder">
                {getInitials(user?.full_name)}
              </div>
            )}
            <div className="file-input-wrapper">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleProfilePicChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <label htmlFor="profile-pic" className="file-input-label" onClick={() => fileInputRef.current?.click()}>
                Change Picture
              </label>
            </div>
          </div>
          
          <h2>Profile Information</h2>
          <p><strong>Username:</strong> {user?.username}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Full Name:</strong> {user?.full_name || 'Not set'}</p>
          <p><strong>Bio:</strong> {user?.bio || 'No bio yet'}</p>
          <div style={{ marginBottom: '15px' }}>
            <strong>Average Rating:</strong>{' '}
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#ffc107' }}>
              {'⭐'.repeat(Math.round(user?.rating || 0))}{'☆'.repeat(5 - Math.round(user?.rating || 0))} {user?.rating?.toFixed(1) || '0.0'} / 5.0
            </span>
            <br />
            <small style={{ color: '#6c757d', fontSize: '13px' }}>
              Based on {user?.total_swaps || 0} completed swap{user?.total_swaps !== 1 ? 's' : ''}
            </small>
          </div>
          <p><strong>Total Swaps:</strong> {user?.total_swaps || 0}</p>
        </div>

        {/* Skills Summary */}
        <div className="card">
          <h2>Skills Summary</h2>
          <p><strong>Skills I Offer:</strong> {offerSkills.length}</p>
          <p><strong>Skills I Want:</strong> {wantSkills.length}</p>
        </div>
      </div>

      {/* Add/Edit Skill Form */}
      {showAddSkill && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h2>{editingSkill ? 'Edit Skill' : 'Add New Skill'}</h2>
          <form onSubmit={editingSkill ? handleUpdateSkill : handleAddSkill}>
            <div className="form-group">
              <label>Skill Name *</label>
              <input
                type="text"
                name="skill_name"
                value={skillForm.skill_name}
                onChange={handleSkillChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Skill Type *</label>
              <select
                name="skill_type"
                value={skillForm.skill_type}
                onChange={handleSkillChange}
                required
              >
                <option value="OFFER">I Offer This</option>
                <option value="WANT">I Want This</option>
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={skillForm.description}
                onChange={handleSkillChange}
                placeholder="Describe your skill level or what you're looking for..."
              />
            </div>
            <div className="form-group">
              <label>Proficiency Level</label>
              <select
                name="proficiency_level"
                value={skillForm.proficiency_level}
                onChange={handleSkillChange}
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              {editingSkill ? 'Update Skill' : 'Add Skill'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowAddSkill(false);
                setEditingSkill(null);
                setSkillForm({ skill_name: '', skill_type: 'OFFER', description: '', proficiency_level: 'Beginner' });
              }}
              style={{ marginLeft: '10px' }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Skills I Offer */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Skills I Offer</h2>
          {!showAddSkill && (
            <button className="btn btn-primary" onClick={() => setShowAddSkill(true)}>
              + Add Skill
            </button>
          )}
        </div>
        {offerSkills.length === 0 ? (
          <p style={{ color: '#666' }}>No skills offered yet. Add some skills!</p>
        ) : (
          <div className="grid">
            {offerSkills.map((skill) => (
              <div key={skill.id} className="match-card">
                <h3>{skill.skill_name}</h3>
                <p><strong>Level:</strong> {skill.proficiency_level}</p>
                {skill.description && <p>{skill.description}</p>}
                <div style={{ marginTop: '15px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEditSkill(skill)}
                    style={{ marginRight: '10px' }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteSkill(skill.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skills I Want */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h2>Skills I Want</h2>
        {wantSkills.length === 0 ? (
          <p style={{ color: '#666' }}>No skills wanted yet. Add skills you want to learn!</p>
        ) : (
          <div className="grid">
            {wantSkills.map((skill) => (
              <div key={skill.id} className="match-card">
                <h3>{skill.skill_name}</h3>
                <p><strong>Level:</strong> {skill.proficiency_level}</p>
                {skill.description && <p>{skill.description}</p>}
                <div style={{ marginTop: '15px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEditSkill(skill)}
                    style={{ marginRight: '10px' }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteSkill(skill.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;

