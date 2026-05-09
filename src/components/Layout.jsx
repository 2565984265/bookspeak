import { Outlet, Link, useLocation } from 'react-router-dom'

function Layout() {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '🏠 首页' },
    { path: '/reader', label: '📖 阅读' },
    { path: '/vocab', label: '📝 生词本' },
    { path: '/speak', label: '🎤 口语' },
    { path: '/progress', label: '📊 进度' },
    { path: '/settings', label: '⚙️ 设置' },
  ]

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1>📚 BookSpeak</h1>
          <p className="tagline">阅读学英语</p>
        </div>
        <ul className="nav-list">
          {navItems.map(item => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <small>v0.1.0 MVP</small>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
