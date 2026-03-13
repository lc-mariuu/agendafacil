const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(express.static('public'))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/agendamentos', require('./routes/appointments'))
app.use('/api/upload', require('./routes/upload'))

app.get('/', (req, res) => {
  res.json({ mensagem: 'ClinicaFacil API funcionando!' })
})

const PORT = process.env.PORT || 3000

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado!')
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.log('Erro ao conectar MongoDB:', err)
  })