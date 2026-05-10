/**
 * 后端地址解析工具
 * 自动处理 localhost 配置在生产环境中的问题
 */

/**
 * 解析并校验后端地址配置
 * @param {string} configuredUrl - 用户配置的后端地址
 * @returns {string} 实际使用的后端地址前缀（空字符串表示同域相对路径）
 */
export function resolveBackendUrl(configuredUrl) {
  const url = (configuredUrl || '').trim()

  // 未配置：使用同域相对路径（由 Nginx 代理到后端）
  if (!url) {
    return ''
  }

  // 生产环境（非 localhost）但配置了 localhost：自动忽略
  const isLocalEnv =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  if (!isLocalEnv && /localhost|127\.0\.0\.1/.test(url)) {
    console.warn(
      '[BookSpeak] 检测到生产环境配置了 localhost 后端地址，已自动忽略，使用同域代理'
    )
    return ''
  }

  // 去掉末尾斜杠
  return url.replace(/\/$/, '')
}
