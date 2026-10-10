import { displayBook, coverGradient, coverPattern } from '../lib/bookDisplay'

export default function BookCover({ book, className = '' }) {
  const { title, author } = displayBook(book)

  if (book.cover_url) {
    return <img className={`bk-cover ${className}`} src={book.cover_url} alt={title} loading="lazy" />
  }

  return (
    <div className={`bk-cover bk-cover-gen bk-pat-${coverPattern(title)} ${className}`} style={{ background: coverGradient(title) }}>
      <span className="bk-cover-rule" />
      <span className="bk-cover-title">{title}</span>
      {author && <span className="bk-cover-author">{author}</span>}
    </div>
  )
}
