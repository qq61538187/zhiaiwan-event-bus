const STORAGE_KEY = 'event-bus-examples-lang'

const textZhToEn = {
  运行: 'Run',
  '绑定监听器': 'Bind Listeners',
  '触发 login': 'Emit login',
  '触发 message': 'Emit message',
  '清空日志': 'Clear Log',
  '触发 async-task': 'Emit async-task',
  '绑定 error 监听': 'Enable Error Reporter',
  '绑定会抛错监听': 'Bind Faulty Listener',
  '触发 request': 'Emit request',
  '触发 calc': 'Emit calc',
  '触发 greet': 'Emit greet',
  '打印快照': 'Print Snapshot',
  '触发 chat.message': 'Emit chat.message',
  '触发 user.login': 'Emit user.login',
  '运行 InMemory + BroadcastChannel': 'Run InMemory + BroadcastChannel',
  '运行 WebWorkerAdapter (MessageChannel)': 'Run WebWorkerAdapter (MessageChannel)',
  验证工具函数: 'Validate Utilities',
  工具函数验证: 'Utility Validation',
  清空输出: 'Clear Output',
  '运行 Node 侧验证': 'Run Node-side Validation',
  'Node 脚本片段': 'Node Script Snippet',
  浏览器适配器: 'Browser Adapters',
  'WebWorkerAdapter（MessageChannel）': 'WebWorkerAdapter (MessageChannel)',
  浏览器内存广播适配: 'InMemory + BroadcastChannel',
  运行工具函数验证: 'Run Utility Validation',
  '绑定 greet': 'Bind greet',
  '绑定 onPattern': 'Bind onPattern',
  'pause(greet)': 'Pause (greet)',
  'resume(greet)': 'Resume (greet)',
  'offGroup(demo)': 'Off Group (demo)',
  'unsubscribeByTag(secondary)': 'Off Tag (secondary)',
  'destroy()': 'Destroy()',
  '交互区': 'Interaction',
  可用示例: 'Available demos',
  交互示例: 'interactive demo',
}

const textEnToZh = Object.fromEntries(Object.entries(textZhToEn).map(([zh, en]) => [en, zh]))

const htmlZhToEn = {
  '演示 <code>on</code> / <code>onPattern</code> / <code>once</code>（通过订阅选项）基础能力。':
    'Demonstrates core APIs: <code>on</code>, <code>onPattern</code>, and <code>once</code> via subscription options.',
  '演示异步监听器默认会被 <code>emit</code> 等待完成，并统计总耗时。':
    'Shows that async listeners are awaited by <code>emit</code> by default, with total elapsed timing.',
  '演示监听器抛错后，如何通过 <code>reporter.onError</code> 统一记录异常。':
    'Shows how listener errors are centrally recorded with <code>reporter.onError</code>.',
  '演示 <code>priority</code> 执行顺序与监听器 <code>ctx</code>（attempt/meta）信息。':
    'Demonstrates <code>priority</code> execution order and listener <code>ctx</code> metadata (attempt/meta).',
  '演示 <code>pause</code> / <code>resume</code> / <code>offGroup</code> / <code>unsubscribeByTag</code> / <code>destroy</code>。':
    'Demonstrates <code>pause</code>, <code>resume</code>, <code>offGroup</code>, <code>unsubscribeByTag</code>, and <code>destroy</code>.',
  '演示 <code>listenerCount</code> / <code>eventNames</code> / <code>replayFor</code> / <code>metrics</code>。':
    'Demonstrates <code>listenerCount</code>, <code>eventNames</code>, <code>replayFor</code>, and <code>metrics</code>.',
  '演示通过 dot 风格事件名（如 <code>chat.message</code>、<code>user.login</code>）组织命名空间。':
    'Demonstrates namespace organization using dot-style event names such as <code>chat.message</code> and <code>user.login</code>.',
  '演示 <code>user.*</code> 与 <code>user.**</code>。':
    'Demonstrates <code>user.*</code> and <code>user.**</code> matching.',
  '演示 <code>InMemoryAdapter</code>、<code>BroadcastChannelAdapter</code> 与 <code>WebWorkerAdapter</code>。':
    'Demonstrates <code>InMemoryAdapter</code>, <code>BroadcastChannelAdapter</code>, and <code>WebWorkerAdapter</code>.',
  '使用 <code>MessageChannel</code> 模拟 Worker 双端通信，验证跨端消息分发链路。':
    'Uses <code>MessageChannel</code> to simulate two-side Worker messaging and verify cross-runtime dispatch.',
  '演示 <code>isPatternMatch</code> 与 <code>patternToRegExp</code> 的直接使用方式。':
    'Demonstrates direct usage of <code>isPatternMatch</code> and <code>patternToRegExp</code>.',
  '演示 <code>emitCollect</code> 的 <code>array / first / race / reduce</code> 聚合策略。':
    'Demonstrates <code>emitCollect</code> strategies: <code>array / first / race / reduce</code>.',
  '点击按钮会在 Node 侧执行 <code>worker_threads</code> 验证脚本并返回结果。':
    'Click the button to execute the Node-side <code>worker_threads</code> validation script and return the result.',
  '该示例用于说明 Node 侧用法：':
    'This demo explains Node-side usage:',
  'build first: <code>pnpm build</code>': 'Build first: <code>pnpm build</code>',
}

const htmlEnToZh = Object.fromEntries(Object.entries(htmlZhToEn).map(([zh, en]) => [en, zh]))

const headingZhToEn = {
  'EventBus 基础示例': 'EventBus Basic Example',
  'Async 监听器示例': 'Async Listener Example',
  'Error 场景示例': 'Error Handling Example',
  '优先级与上下文示例': 'Priority & Context Example',
  '生命周期管理示例': 'Lifecycle Management Example',
  '状态观测示例': 'Runtime Introspection Example',
  命名空间示例: 'Namespace Example',
  模式匹配: 'Pattern Matching',
  策略控制: 'Policies',
  回放与粘性事件: 'Replay Sticky',
  浏览器适配器: 'Browser Adapters',
  可观测性: 'Observability',
  Node线程适配器示例: 'Node worker_threads Adapter',
  'Pattern 工具函数示例': 'Pattern Utilities Example',
  聚合收集示例: 'emitCollect',
}

const headingEnToZh = Object.fromEntries(
  Object.entries(headingZhToEn).map(([zh, en]) => [en, zh]),
)

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function translateText(value, lang) {
  const normalized = normalize(value)
  if (!normalized) return value
  if (lang === 'en' && textZhToEn[normalized]) {
    return value.replace(normalized, textZhToEn[normalized])
  }
  if (lang === 'zh' && textEnToZh[normalized]) {
    return value.replace(normalized, textEnToZh[normalized])
  }
  return value
}

function translateHeading(lang) {
  const h1 = document.querySelector('.page-header h1')
  if (!h1) return
  const text = normalize(h1.textContent || '')
  if (lang === 'en' && headingZhToEn[text]) h1.textContent = headingZhToEn[text]
  if (lang === 'zh' && headingEnToZh[text]) h1.textContent = headingEnToZh[text]
}

function translateHeaderParagraph(lang) {
  const paragraph = document.querySelector('.page-header p')
  if (!paragraph) return
  const html = normalize(paragraph.innerHTML)
  if (lang === 'en' && htmlZhToEn[html]) paragraph.innerHTML = htmlZhToEn[html]
  if (lang === 'zh' && htmlEnToZh[html]) paragraph.innerHTML = htmlEnToZh[html]
}

function isInsideOutput(node) {
  const parent = node.parentElement
  return Boolean(parent?.closest('.output, .log, pre, code, script, style'))
}

function translateTextNodes(lang) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    if (isInsideOutput(node)) continue
    const original = node.nodeValue || ''
    const translated = translateText(original, lang)
    if (translated !== original) node.nodeValue = translated
  }
}

function translateTitle(lang) {
  const title = document.querySelector('title')
  if (!title) return
  const original = title.textContent || ''
  const translated = translateText(original, lang)
  title.textContent = translated
}

function updateToggleUI(lang) {
  document.querySelectorAll('.i18n-toggle button').forEach((button) => {
    const isActive = button.dataset.lang === lang
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })
}

function applyLanguage(lang) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  translateTitle(lang)
  translateHeading(lang)
  translateHeaderParagraph(lang)
  translateTextNodes(lang)
  updateToggleUI(lang)
}

function createToggle() {
  const wrapper = document.createElement('div')
  wrapper.className = 'i18n-toggle'
  wrapper.setAttribute('role', 'group')
  wrapper.setAttribute('aria-label', 'Switch language')
  wrapper.innerHTML = `
    <button type="button" data-lang="zh" aria-label="切换中文">中文</button>
    <button type="button" data-lang="en" aria-label="Switch to English">EN</button>
  `

  wrapper.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) return
    const lang = target.dataset.lang === 'en' ? 'en' : 'zh'
    localStorage.setItem(STORAGE_KEY, lang)
    applyLanguage(lang)
  })

  document.body.appendChild(wrapper)
}

function getInitialLang() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function init() {
  if (!document.body) return
  createToggle()
  applyLanguage(getInitialLang())
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
