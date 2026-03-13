const express = require('express')
const cloudinary = require('cloudinary').v2
const jwt = require('jsonwebtoken')
const router = express.Router()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    jwt.verify(token, process.env.JWT_SECRET)

    const { imagem } = req.body
    if (!imagem) return res.status(400).json({ erro: 'Imagem não enviada' })

    const resultado = await cloudinary.uploader.upload(imagem, {
      folder: 'agendafacil',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
    })

    res.json({ url: resultado.secure_url })
  } catch (err) {
    console.log('Erro upload:', err.message)
    res.status(500).json({ erro: 'Erro ao fazer upload' })
  }
})

module.exports = router