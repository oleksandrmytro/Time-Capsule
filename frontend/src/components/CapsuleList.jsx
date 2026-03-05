export default function CapsuleList({ capsules, onSelect, onCreate, onBack }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('uk-UA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return '#6c757d'
      case 'sealed':
        return '#007bff'
      case 'opened':
        return '#28a745'
      default:
        return '#000'
    }
  }

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'private':
        return '🔒'
      case 'public':
        return '🌐'
      case 'shared':
        return '🔗'
      default:
        return ''
    }
  }

  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <h2>My Time Capsules</h2>
        <div style={styles.actions}>
          <button onClick={onCreate} style={styles.createButton}>
            + Create Capsule
          </button>
        </div>
      </div>

      {capsules.length === 0 ? (
        <div style={styles.empty}>
          <p>No capsules yet. Create your first time capsule!</p>
          <button onClick={onCreate} style={styles.createButton}>
            Create Your First Capsule
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {capsules.map((capsule) => (
            <div
              key={capsule.id}
              style={styles.card}
              onClick={() => onSelect(capsule.id)}
            >
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>{capsule.title}</h3>
                <span style={styles.visibilityIcon}>
                  {getVisibilityIcon(capsule.visibility)}
                </span>
              </div>

              {capsule.body && (
                <p style={styles.cardBody}>
                  {capsule.body.length > 100
                    ? `${capsule.body.substring(0, 100)}...`
                    : capsule.body}
                </p>
              )}

              <div style={styles.cardMeta}>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(capsule.status),
                  }}
                >
                  {capsule.status}
                </span>
                <span style={styles.date}>
                  🕐 {formatDate(capsule.unlockAt)}
                </span>
              </div>

              {capsule.tags && capsule.tags.length > 0 && (
                <div style={styles.tags}>
                  {capsule.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} style={styles.tag}>
                      #{tag}
                    </span>
                  ))}
                  {capsule.tags.length > 3 && (
                    <span style={styles.tag}>+{capsule.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {onBack && (
        <div style={styles.footer}>
          <button onClick={onBack} style={styles.backButton}>
            ← Back to Home
          </button>
        </div>
      )}
    </section>
  )
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
  },
  createButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '20px',
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  visibilityIcon: {
    fontSize: '20px',
    marginLeft: '10px',
  },
  cardBody: {
    margin: '10px 0',
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5',
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '15px',
    fontSize: '12px',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: '11px',
  },
  date: {
    color: '#666',
    fontSize: '12px',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  },
  tag: {
    padding: '3px 8px',
    backgroundColor: '#f0f0f0',
    borderRadius: '3px',
    fontSize: '11px',
    color: '#555',
  },
  footer: {
    marginTop: '30px',
    textAlign: 'center',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
}

