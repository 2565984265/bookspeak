import Reader from '../components/Reader'
import ErrorBoundary from '../components/ErrorBoundary'

function ReaderPage() {
  return (
    <div className="reader-page">
      <ErrorBoundary>
        <Reader />
      </ErrorBoundary>
    </div>
  )
}

export default ReaderPage
