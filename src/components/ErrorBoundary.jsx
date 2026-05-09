import { Component } from 'react'

/**
 * React 错误边界
 * 捕获子组件渲染错误，显示友好提示
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #ff6b6b',
          borderRadius: '8px',
          background: '#fff5f5',
          color: '#c92a2a',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          <h2 style={{ marginTop: 0 }}>😵 渲染出错了</h2>
          <p><strong>错误类型：</strong>{this.state.error?.name}</p>
          <p><strong>错误消息：</strong>{this.state.error?.message}</p>
          {this.state.error?.stack && (
            <details>
              <summary>点击查看堆栈</summary>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
          {this.state.errorInfo?.componentStack && (
            <details>
              <summary>点击查看组件堆栈</summary>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
