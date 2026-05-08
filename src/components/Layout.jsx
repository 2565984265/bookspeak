import { Outlet, Link } from 'react-router-dom'

function Layout() {
  return (
    <div className="app">
      <nav className="sidebar">
        <h1>📚 BookSpeak</h1>
        <ul>
          <li><Link to="/">首页</Link></li>
          <li><Link to="/reader">阅读</Link></li>
          <li><Link to="/vocab">生词本</Link></li>
          <li><Link to="/speak">口语</Link></li>
          <li><Link to="/progress">进度</Link></li>
          <li><Link to="/settings">设置</Link></li>
        </ul>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
