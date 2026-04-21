const jwt    = require('jsonwebtoken')
const User   = require('../models/User')
 
/* ── Autenticação JWT ─────────────────────────────────────────── */
const autenticar = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ erro: 'Sem autorização' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido' })
  }
}
 
/* ── Verifica se tem acesso (trial ativo OU assinatura ativa) ─── */
const verificarAcesso = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })
 
    req.user = user
 
    if (user.temAcesso()) return next()
 
    return res.status(403).json({
      erro:   'Assinatura necessária',
      codigo: 'SEM_ACESSO',
      plano:  user.plano,
    })
  } catch (err) {
    console.error('[verificarAcesso]', err.message)
    return res.status(500).json({ erro: 'Erro interno' })
  }
}
 
/* ── Verifica se é plano específico ou superior ───────────────── */
// Hierarquia: trial < basico < profissional
const HIERARQUIA = { trial: 0, basico: 1, profissional: 2, pro: 2 }
 
const apenasPlano = (planoMinimo) => async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })
 
    req.user = user
 
    if (!user.assinaturaAtiva) {
      return res.status(403).json({
        erro:   'Assinatura necessária para usar este recurso',
        codigo: 'SEM_ASSINATURA',
        plano:  user.plano,
      })
    }
 
    const nivelUsuario  = HIERARQUIA[user.plano] ?? 0
    const nivelMinimo   = HIERARQUIA[planoMinimo] ?? 99
 
    if (nivelUsuario >= nivelMinimo) return next()
 
    return res.status(403).json({
      erro:   `Este recurso requer o plano ${planoMinimo} ou superior`,
      codigo: 'PLANO_INSUFICIENTE',
      plano:  user.plano,
    })
  } catch (err) {
    console.error('[apenasPlano]', err.message)
    return res.status(500).json({ erro: 'Erro interno' })
  }
}
 
module.exports = { autenticar, verificarAcesso, apenasPlano }
 