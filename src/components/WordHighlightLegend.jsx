import { useBookStore } from '../hooks/useStore'

/**
 * 单词高亮图例组件
 * 显示已掌握/不认识/生词本的数量和开关
 */

function WordHighlightLegend({ showHighlight, onToggle }) {
  const knownWords = useBookStore(state => state.knownWords)
  const unknownWords = useBookStore(state => state.unknownWords)
  const wordList = useBookStore(state => state.wordList)

  return (
    <div className="highlight-legend">
      <div className="legend-items">
        <span className={`legend-item known ${showHighlight ? '' : 'dimmed'}`} title="已掌握">
          <span className="legend-dot known" /> 已掌握 {knownWords.size}
        </span>
        <span className={`legend-item unknown ${showHighlight ? '' : 'dimmed'}`} title="不认识">
          <span className="legend-dot unknown" /> 不认识 {unknownWords.size}
        </span>
        <span className={`legend-item vocab ${showHighlight ? '' : 'dimmed'}`} title="生词本">
          <span className="legend-dot vocab" /> 生词本 {wordList.length}
        </span>
      </div>
      <button
        className={`legend-toggle ${showHighlight ? 'active' : ''}`}
        onClick={onToggle}
        title={showHighlight ? '隐藏高亮' : '显示高亮'}
      >
        {showHighlight ? '👁️ 高亮开' : '👁️‍🗨️ 高亮关'}
      </button>
    </div>
  )
}

export default WordHighlightLegend
