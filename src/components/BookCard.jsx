import BookCover from './BookCover'
import { displayBook } from '../lib/bookDisplay'

export default function BookCard({ book, onClick }) {
  const { title, author } = displayBook(book)

  return (
    <div className="bk-card" onClick={onClick}>
      <BookCover book={book} />
      <div className="bk-card-title">{title}</div>
      <div className="bk-card-author">{author || 'Unknown author'}</div>
      {book.shelf === 'reading' && book.progress > 0 && (
        <div className="bk-bar"><div style={{ width: `${book.progress}%` }} /></div>
      )}
    </div>
  )
}
