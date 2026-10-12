import { getUser, publicProfile, send } from '../_lib/auth.js'
export default async function handler(req, res) {
  const u = await getUser(req)
  if (!u) return send(res, 401, { error: 'Not signed in' })
  return send(res, 200, { profile: publicProfile(u) })
}
