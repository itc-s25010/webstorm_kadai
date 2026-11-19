// Express を使ったバックエンドでのログインチェック例
import type { Request, Response, NextFunction } from 'express';

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  // セッションやトークンでログイン済みか確認する（環境に合わせて変更）
  const isLoggedIn = Boolean(req.headers.authorization);

  if (!isLoggedIn) {
    // ログイン画面へリダイレクト、または 401 エラーを返す
    return res.status(401).json({ message: 'ログインが必要です' });
  }
  // ログイン済みなら次の処理へ進む
  next();
}
