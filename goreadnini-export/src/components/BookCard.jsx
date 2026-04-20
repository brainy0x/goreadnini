import { BookOpen } from 'lucide-react'

export default function BookCard({ book, onClick }) {
  const shelfColor = { reading: '#e87090', finished: '#c9a84c', wishlist: '#8899dd', paused: '#a89070' }

  return (
    <div className="book-card" onClick={onClick}>
      {book.cover_url ? (
        <img className="book-cover" src={book.cover_url} alt={book.title} loading="lazy" />
      ) : (
        <div className="book-cover-placeholder">
          <BookOpen />
          <span>{book.title}</span>
        </div>
      )}
      <div className="book-info">
        <div className="book-title">{book.title}</div>
        <div className="book-author">{book.author || 'Unknown author'}</div>
        {book.shelf && (
          <div style={{ marginTop: '0.4rem' }}>
            <span className={`shelf-badge ${book.shelf}`}>{book.shelf}</span>
          </div>
        )}
        {book.shelf === 'reading' && (
          <div className="book-progress-bar">
            <div className="book-progress-fill" style={{ width: `${book.progress || 0}%` }} />
          </div>
        )}
        {book.rating && (
          <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: 'var(--gold)' }}>
            {'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}
          </div>
        )}
      </div>
    </div>
  )
}
