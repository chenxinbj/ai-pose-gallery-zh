import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, watch: null },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
})
after(() => server.close())
const { toPublicHttpsUrl } = await server.ssrLoadModule('/src/services/aiGenerator.ts')

const LOCAL_SOURCES = [
  'img/portrait/f71f980dde3.webp',
  'thumbs/portrait/f71f980dde3.webp',
  'img/costume/SPR-0001.webp',
  'thumbs/costume/SPR-0001.webp',
  'img/costumes/shisei/costume_C001_back.webp',
  'thumbs/costumes/shisei/costume_C001_back.webp',
  'img/depth/full_sexy_P001_diag.webp',
  'thumbs/depth/full_sexy_P001_diag.webp',
  'img/full_sexy_P001_front.png',
  'thumbs/full_sexy_P001_front.jpg',
]

function withLocation(location, run) {
  const original = globalThis.window
  globalThis.window = { location }
  try {
    return run()
  } finally {
    if (original === undefined) delete globalThis.window
    else globalThis.window = original
  }
}

test('localhost 开发态把参考图映射为公网镜像的同一相对路径', () => {
  //given 本地开发态的窗口地址
  const location = { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:5173' }
  for (const src of LOCAL_SOURCES) {
    //when 计算公网可访问地址
    const url = new URL(withLocation(location, () => toPublicHttpsUrl(src)))
    //then 相对路径原样保留，公网镜像才能取到同一份素材
    assert.equal(url.pathname.replace(/^\//, ''), src, `${src} 的相对路径必须保持不变`)
  }
})

test('localhost 开发态映射结果必须是 https 公网地址', () => {
  //given 本地开发态的窗口地址
  const location = { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:5173' }
  for (const src of LOCAL_SOURCES) {
    //when 计算公网可访问地址
    const url = new URL(withLocation(location, () => toPublicHttpsUrl(src)))
    //then 云端生图接口才能直接拉取
    assert.equal(url.protocol, 'https:', `${src} 必须映射为 https`)
  }
})

test('已部署的 https 站点继续使用当前站点地址', () => {
  //given 已部署到公网 https 域名的窗口地址
  const location = { protocol: 'https:', hostname: 'ai-pose-gallery.anhao.app', origin: 'https://ai-pose-gallery.anhao.app' }
  //when 计算公网可访问地址
  const url = withLocation(location, () => toPublicHttpsUrl('img/portrait/f71f980dde3.webp'))
  //then 部署环境行为不变
  assert.equal(url, 'https://ai-pose-gallery.anhao.app/img/portrait/f71f980dde3.webp')
})

test('绝对地址与 data URL 原样透传', () => {
  //given 已经是公网地址或内联数据的输入
  const absolute = 'https://example.com/a.png'
  const inline = 'data:image/png;base64,AA=='
  //when 经过映射
  //then 不做任何改写
  assert.equal(toPublicHttpsUrl(absolute), absolute)
  assert.equal(toPublicHttpsUrl(inline), inline)
})
