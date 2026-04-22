/**
 * routes/pagamentosConfig.js
 */

const express = require('express')
const router  = express.Router()
const Negocio = require('../models/Negocio')

const { autenticar, verificarAcesso } = require('../middleware/acesso')

// ── Defaults ────────────────────────────────────────────────────────────────
const CONFIG_DEFAULT = {
  adiantado:        false,
  tipoValor:        'total',
  porcentagem:      50,
  valorFixo:        0,
  reembolso:        true,
  reembolsoCliente: true,
  reembolsoVoce:    true,
}

// ── GET /api/pagamentos/config-publica/:negocioId  (SEM autenticação) ────────
// Usado pelo frontend público de agendamento para saber se deve cobrar Pix
router.get('/config-publica/:negocioId', async (req, res) => {
  try {
    const negocio = await Negocio.findById(req.params.negocioId)
      .select('pagamentosConfig')
      .lean()

    if (!negocio) {
      return res.status(404).json({ success: false, message: 'Negócio não encontrado' })
    }

    const config = {
      ...CONFIG_DEFAULT,
      ...(negocio.pagamentosConfig || {}),
    }

    return res.json({ success: true, ...config })
  } catch (err) {
    console.error('[pagamentos] GET /config-publica:', err)
    return res.status(500).json({ success: false, message: 'Erro interno' })
  }
})

// ── GET /api/pagamentos/config ───────────────────────────────────────────────
router.get('/config', autenticar, verificarAcesso, async (req, res) => {
  try {
    const userId    = req.userId
    const negocioId = req.query.negocioId
    const filtro    = negocioId ? { _id: negocioId, userId } : { userId }

    const negocio = await Negocio.findOne(filtro)
      .select('pagamentosConfig')
      .lean()

    const config = {
      ...CONFIG_DEFAULT,
      ...(negocio?.pagamentosConfig || {}),
    }

    return res.json({ success: true, config })
  } catch (err) {
    console.error('[pagamentos] GET /config:', err)
    return res.status(500).json({ success: false, message: 'Erro interno' })
  }
})

// ── POST /api/pagamentos/config ──────────────────────────────────────────────
router.post('/config', autenticar, verificarAcesso, async (req, res) => {
  try {
    const userId          = req.userId
    const { config, negocioId } = req.body

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ success: false, message: 'Config inválida' })
    }

    const configLimpa = {
      adiantado:        Boolean(config.adiantado),
      tipoValor:        ['total', 'personalizado', 'fixo'].includes(config.tipoValor)
                          ? config.tipoValor : 'total',
      porcentagem:      Math.min(100, Math.max(0, Number(config.porcentagem) || 50)),
      valorFixo:        Math.max(0, Number(config.valorFixo) || 0),
      reembolso:        Boolean(config.reembolso),
      reembolsoCliente: Boolean(config.reembolsoCliente),
      reembolsoVoce:    Boolean(config.reembolsoVoce),
      updatedAt:        new Date(),
    }

    const filtro = negocioId ? { _id: negocioId, userId } : { userId }

    const negocio = await Negocio.findOneAndUpdate(
      filtro,
      { $set: { pagamentosConfig: configLimpa, atualizadoEm: new Date() } },
      { new: true, upsert: false }
    )

    if (!negocio) {
      return res.status(404).json({ success: false, message: 'Negócio não encontrado' })
    }

    return res.json({ success: true, config: configLimpa })
  } catch (err) {
    console.error('[pagamentos] POST /config:', err)
    return res.status(500).json({ success: false, message: 'Erro ao salvar' })
  }
})

module.exports = router