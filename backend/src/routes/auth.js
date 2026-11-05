const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Login simplificado (para desarrollo)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // En desarrollo, aceptamos cualquier email/password
    const user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: email || 'admin@turnsoft.cl',
      rol: 'admin',
      empresa_id: '00000000-0000-0000-0000-000000000000'
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, empresa_id: user.empresa_id },
      process.env.JWT_SECRET || 'secret_dev',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', (req, res) => {
  res.json({ message: 'Endpoint protegido - requiere token válido' });
});

module.exports = router;