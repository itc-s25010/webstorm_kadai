import session from 'express-session'
import express from 'express'
import argon2 from 'argon2'
import { prisma } from './libs/prisma'
import type { Request, Response, NextFunction } from 'express'

function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.redirect('/login')
  }
  next()
}

const app = express()

app.set('view engine', 'ejs')
app.set('views', './views')

declare module 'express-session' {
  interface SessionData {
    userId: string
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
}))

app.use(session({
  secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
}))
app.use(express.urlencoded({ extended: true }))

const argon2Options: argon2.HashOptions = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

// 登録画面
app.get('/register', (req, res) => {
  res.send(`
    <h1>新規登録</h1>
    <form method="post" action="/register">
      <p><input name="name" placeholder="表示名"></p>
      <p><input name="email" type="email" placeholder="メール" required></p>
      <p><input name="password" type="password" placeholder="パスワード" required></p>
      <button>登録</button>
    </form>
  `)
})

// 登録処理
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body

  if (!email || !password) {
    return res.status(400).send('メールとパスワードは必須です')
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return res.status(409).send('このメールアドレスは登録済みです')
  }

  await prisma.user.create({
    data: {
      name: name || null,
      email,
      password: await argon2.hash(password, argon2Options),
    },
  })

  res.send('/login')
})

// ログイン画面
app.get('/login', (req, res) => {
  res.send(`
    <h1>ログイン</h1>
    <form method="post" action="/login">
      <p><input name="email" type="email" placeholder="メール" required></p>
      <p><input name="password" type="password" placeholder="パスワード" required></p>
      <button>ログイン</button>
    </form>
    <p><a href="/register">新規登録はこちら</a></p>
  `)
})

// ログイン処理
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  // 退会済み(deletedAt あり)のユーザーは除外する
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  })

  if (!user || !(await argon2.verify(user.password, password))) {
    return res.status(401).send('メールまたはパスワードが違います')
  }

  req.session.userId = user.id
  res.redirect('/')
})

// ログアウト
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'))
})

// トピック一覧
app.get('/', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const topics = await prisma.topic.findMany({
    where: { deletedAt: null },
    include: { author: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.render('topics', { user, topics, error: null })
})

// トピック作成
app.post('/topics', requireLogin, async (req, res) => {
  const title = String(req.body.title ?? '').trim()

  if (!title || title.length > 256) {
    return res.status(400).send('タイトルは1〜256文字で入力してください')
  }

  await prisma.topic.create({
    data: { title, authorId: req.session.userId! },
  })
  res.redirect('/')
})

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// トピック詳細
app.get('/topics/:id', requireLogin, async (req, res) => {
  const id = String(req.params.id)
  if (!uuidPattern.test(id)) {
    return res.status(404).send('トピックが見つかりません')
  }

  const topic = await prisma.topic.findFirst({
    where: { id, deletedAt: null },
    include: { author: { select: { name: true, email: true } } },
  })
  if (!topic) {
    return res.status(404).send('トピックが見つかりません')
  }

  const posts = await prisma.post.findMany({
    where: { topicId: id, deletedAt: null },
    include: { contributor: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })

  res.render('topic', { topic, posts })
})

// 投稿の作成
app.post('/topics/:id/posts', requireLogin, async (req, res) => {
  const id = String(req.params.id)
  if (!uuidPattern.test(id)) {
    return res.status(404).send('トピックが見つかりません')
  }

  const message = String(req.body.message ?? '').trim()
  if (!message || message.length > 512) {
    return res.status(400).send('メッセージは1〜512文字で入力してください')
  }

  const topic = await prisma.topic.findFirst({ where: { id, deletedAt: null } })
  if (!topic) {
    return res.status(404).send('トピックが見つかりません')
  }

  await prisma.post.create({
    data: { topicId: id, contributorId: req.session.userId!, message },
  })
  res.redirect(`/topics/${id}`)
})

app.listen(3000, () => {
  console.log('http://localhost:3000')
})