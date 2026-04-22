/**
 * routes/pagamento.js  (ou crie routes/pagamentos-config.js separado)
 *
 * GET  /api/pagamentos/config  → retorna config salva
 * POST /api/pagamentos/config  → salva config
 */

const express = require('express');
const router = express.Router();

// Ajuste o caminho conforme sua estrutura de models
let Negocio;
let User;
try {
  Negocio = require('../models/Negocio');
  User = require('../models/User');
} catch (e) {
  console.error('[pagamentos route] Erro ao importar models:', e.message);
}

// Middleware de autenticação — ajuste para o seu
const autenticar = require('../middleware/acesso');

// ── GET /api/pagamentos/config ────────────────────────────────────
router.get('/config', autenticar, async (req, res) => {
  try {
    const userId = req.usuario?.id || req.user?.id || req.userId;

    // Busca no banco — ajuste conforme seu schema
    const negocio = await Negocio.findOne({ usuario: userId })
      .select('pagamentosConfig')
      .lean();

    const configPadrao = {
      adiantado: false,
      tipoValor: 'total',
      porcentagem: 50,
      valorFixo: 0,
      reembolso: true,
      reembolsoCliente: true,
      reembolsoVoce: true
    };

    const config = negocio?.pagamentosConfig
      ? { ...configPadrao, ...negocio.pagamentosConfig }
      : configPadrao;

    return res.json({ success: true, config });
  } catch (err) {
    console.error('[pagamentos] GET /config erro:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// ── POST /api/pagamentos/config ───────────────────────────────────
router.post('/config', autenticar, async (req, res) => {
  try {
    const userId = req.usuario?.id || req.user?.id || req.userId;
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ success: false, message: 'Config inválida' });
    }

    // Valida e sanitiza
    const configLimpa = {
      adiantado: Boolean(config.adiantado),
      tipoValor: ['total', 'personalizado', 'fixo'].includes(config.tipoValor)
        ? config.tipoValor
        : 'total',
      porcentagem: Math.min(100, Math.max(0, Number(config.porcentagem) || 50)),
      valorFixo: Math.max(0, Number(config.valorFixo) || 0),
      reembolso: Boolean(config.reembolso),
      reembolsoCliente: Boolean(config.reembolsoCliente),
      reembolsoVoce: Boolean(config.reembolsoVoce)
    };

    // Atualiza no banco
    await Negocio.findOneAndUpdate(
      { usuario: userId },
      { $set: { pagamentosConfig: configLimpa, updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    console.log(`[pagamentos] Config salva para usuário ${userId}:`, configLimpa);
    return res.json({ success: true, config: configLimpa, message: 'Configurações salvas!' });
  } catch (err) {
    console.error('[pagamentos] POST /config erro:', err);
    return res.status(500).json({ success: false, message: 'Erro ao salvar configurações' });
  }
});

module.exports = router;