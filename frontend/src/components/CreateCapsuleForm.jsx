import { useState } from 'react'

export default function CreateCapsuleForm({ onSubmit, onCancel, error }) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    visibility: 'private',
    status: 'sealed',
    unlockAt: '',
    expiresAt: '',
    allowComments: true,
    allowReactions: true,
    tags: '',
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Validation
    if (!formData.title.trim()) {
      alert('Title is required')
      return
    }

    if (!formData.unlockAt) {
      alert('Unlock date is required')
      return
    }

    // Check if unlock date is in the future
    const unlockDate = new Date(formData.unlockAt)
    if (unlockDate <= new Date()) {
      alert('Unlock date must be in the future')
      return
    }

    // Prepare data for submission
    const capsuleData = {
      title: formData.title.trim(),
      body: formData.body.trim() || null,
      visibility: formData.visibility,
      status: formData.status,
      unlockAt: new Date(formData.unlockAt).toISOString(),
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
      allowComments: formData.allowComments,
      allowReactions: formData.allowReactions,
      tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : null,
      media: null, // No media for now
      location: null, // No location for now
    }

    onSubmit(capsuleData)
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.title}>Create Time Capsule</h2>

      {error && (
        <div style={styles.error}>
          {error.message || 'Failed to create capsule'}
        </div>
      )}

      <div style={styles.field}>
        <label style={styles.label}>Title *</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          maxLength={200}
          required
          style={styles.input}
          placeholder="Give your capsule a title"
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Message</label>
        <textarea
          name="body"
          value={formData.body}
          onChange={handleChange}
          maxLength={5000}
          rows={6}
          style={styles.textarea}
          placeholder="Write your message for the future..."
        />
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Visibility *</label>
          <select
            name="visibility"
            value={formData.visibility}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="private">Private (only you)</option>
            <option value="public">Public (everyone)</option>
            <option value="shared">Shared (with link)</option>
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Status *</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="draft">Draft</option>
            <option value="sealed">Sealed</option>
            <option value="opened">Opened</option>
          </select>
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Unlock Date *</label>
          <input
            type="datetime-local"
            name="unlockAt"
            value={formData.unlockAt}
            onChange={handleChange}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Expires Date (optional)</label>
          <input
            type="datetime-local"
            name="expiresAt"
            value={formData.expiresAt}
            onChange={handleChange}
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Tags (comma-separated)</label>
        <input
          type="text"
          name="tags"
          value={formData.tags}
          onChange={handleChange}
          style={styles.input}
          placeholder="memories, birthday, 2026"
        />
      </div>

      <div style={styles.checkboxRow}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="allowComments"
            checked={formData.allowComments}
            onChange={handleChange}
            style={styles.checkbox}
          />
          Allow comments
        </label>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="allowReactions"
            checked={formData.allowReactions}
            onChange={handleChange}
            style={styles.checkbox}
          />
          Allow reactions
        </label>
      </div>

      <div style={styles.buttons}>
        <button type="submit" style={styles.submitButton}>
          Create Capsule
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}

const styles = {
  form: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    marginBottom: '20px',
    color: '#333',
  },
  error: {
    padding: '10px',
    marginBottom: '20px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px',
    border: '1px solid #fcc',
  },
  field: {
    marginBottom: '15px',
    flex: 1,
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: '600',
    color: '#555',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  row: {
    display: 'flex',
    gap: '15px',
    marginBottom: '15px',
  },
  checkboxRow: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    color: '#555',
  },
  checkbox: {
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  },
  buttons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  submitButton: {
    padding: '10px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '10px 24px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}

