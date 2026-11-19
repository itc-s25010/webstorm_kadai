import {prisma} from '../libs/prisma'
import argon2 from 'argon2'

// Argon2id のパラメータ
const argon2Options: argon2.HashOptions = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
}

// User の初期(ダミー)データ
const dummyUser = [
  {email: 'taro@example.com', password: 'yamada', name: 'Taro'},
  {email: 'hanako@example.com', password: 'flower', name: 'Hanako'},
  {email: 'sachiko@example.com', password: 'happy', name: 'Sachiko'},
  {email: 'jiro@example.com', password: 'change', name: 'Jiro'},
  {email: 'mami@example.com', password: 'mumemo', name: 'Mami'},
  {email: 'ichiro@example.com', password: 'baseball', name: 'Ichiro'},
  {email: 'kumi@example.com', password: 'co', name: 'Kumi'},
]

const dummyPost = [
  {user: 1, message: 'Hello!'},
  {user: 2, message: 'こんにちは！　試しに書いてみますね。'}
]

async function main() {
  const users = []
  for (const u of dummyUser) {
    users.push(await prisma.user.create({
      data: { email: u.email, name: u.name, password: await argon2.hash(u.password, argon2Options) },
    }))
  }

  const topic = await prisma.topic.create({
    data: { authorId: users[0].id, title: 'はじめてのトピック' },
  })

  await prisma.post.create({
    data: { topicId: topic.id, contributorId: users[0].id, message: 'Hello!' },
  })
}

main()
  .then(async () => {
    await prisma.$connect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$connect()
    process.exit(1)
  })