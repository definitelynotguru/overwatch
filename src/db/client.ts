import postgres from 'postgres'

const url =
  process.env.DATABASE_URL ??
  'postgres://overwatch:overwatch@127.0.0.1:5432/overwatch'

export const sql = postgres(url, {
  max: 8,
  idle_timeout: 20,
  connect_timeout: 10,
})
