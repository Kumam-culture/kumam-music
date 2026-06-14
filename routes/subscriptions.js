const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const PLANS = {
  listener_basic: { name: 'Listener Basic (Free)', amount: 0, duration_months: 0 },
  listener_premium: { name: 'Listener Premium', amount: 5000, duration_months: 1, currency: 'UGX' },
  artist_annual: { name: 'Artist Annual', amount: 15000, duration_months: 12, currency: 'UGX' }
};

// GET /api/subscriptions/plans
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/subscriptions/my-subscription
router.get('/my-subscription', authenticate, async (req, res) => {
  try {
    const [subs] = await pool.execute(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.user.id]
    );
    const active = subs.find(s => s.status === 'active' && new Date(s.end_date) >= new Date());
    res.json({ subscriptions: subs, active: active || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/initiate
router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { plan, payment_method, payment_phone } = req.body;

    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    if (!['mtn', 'airtel'].includes(payment_method)) return res.status(400).json({ error: 'Payment method must be MTN or Airtel' });
    if (!payment_phone) return res.status(400).json({ error: 'Payment phone number required' });

    const planInfo = PLANS[plan];
    if (planInfo.amount === 0) return res.status(400).json({ error: 'Free plan requires no payment' });

    // Validate phone format (Uganda)
    const mtnPattern = /^(0?7[689]\d{7}|256?7[689]\d{7})$/;
    const airtelPattern = /^(0?7[012]\d{7}|256?7[012]\d{7})$/;
    if (payment_method === 'mtn' && !mtnPattern.test(payment_phone.replace(/\s/g, '')))
      return res.status(400).json({ error: 'Invalid MTN number. Use format: 0761234567' });
    if (payment_method === 'airtel' && !airtelPattern.test(payment_phone.replace(/\s/g, '')))
      return res.status(400).json({ error: 'Invalid Airtel number. Use format: 0701234567' });

    // Validate artist plan
    if (plan === 'artist_annual' && req.user.role !== 'artist')
      return res.status(400).json({ error: 'Artist plan is for artists only' });
    if (plan === 'listener_premium' && req.user.role === 'artist')
      return res.status(400).json({ error: 'Artists use the artist annual plan' });

    const transactionRef = `KMM-${Date.now()}-${uuidv4().slice(0,8).toUpperCase()}`;

    const [result] = await pool.execute(
      `INSERT INTO subscriptions (user_id, plan, status, amount, payment_method, payment_phone, transaction_ref)
       VALUES (?,?,?,?,?,?,?)`,
      [req.user.id, plan, 'pending', planInfo.amount, payment_method, payment_phone, transactionRef]
    );

    // Simulate mobile money prompt (in production, call MTN/Airtel API here)
    res.json({
      message: `Payment request sent to ${payment_phone}. Please approve the ${payment_method.toUpperCase()} Mobile Money prompt on your phone.`,
      transaction_ref: transactionRef,
      subscription_id: result.insertId,
      amount: planInfo.amount,
      instructions: payment_method === 'mtn'
        ? `Check your MTN phone for a payment prompt. Enter your MTN MoMo PIN to approve UGX ${planInfo.amount.toLocaleString()} for ${planInfo.name}.`
        : `Check your Airtel phone for a payment prompt. Enter your Airtel Money PIN to approve UGX ${planInfo.amount.toLocaleString()} for ${planInfo.name}.`,
      ussd_code: payment_method === 'mtn'
        ? `Or dial *165*3*${planInfo.amount}*${transactionRef}# to pay manually`
        : `Or dial *185*7*${planInfo.amount}*${transactionRef}# to pay manually`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/verify - simulate payment verification
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { transaction_ref } = req.body;
    const [subs] = await pool.execute(
      'SELECT * FROM subscriptions WHERE transaction_ref = ? AND user_id = ?',
      [transaction_ref, req.user.id]
    );
    if (!subs.length) return res.status(404).json({ error: 'Transaction not found' });
    const sub = subs[0];
    if (sub.status === 'active') return res.json({ status: 'active', message: 'Subscription already active' });
    if (sub.status !== 'pending') return res.json({ status: sub.status });

    // In production: call MTN/Airtel API to verify payment
    // For demo: auto-approve after 30 seconds (simulate)
    const createdTime = new Date(sub.created_at).getTime();
    const now = Date.now();
    const elapsed = now - createdTime;

    if (elapsed < 10000) {
      return res.json({ status: 'pending', message: 'Awaiting payment confirmation. Please approve the prompt on your phone.' });
    }

    // Auto-approve for demo (remove in production, use real webhook)
    const startDate = new Date();
    const endDate = new Date();
    const planInfo = PLANS[sub.plan];
    endDate.setMonth(endDate.getMonth() + planInfo.duration_months);

    await pool.execute(
      'UPDATE subscriptions SET status = "active", start_date = ?, end_date = ? WHERE id = ?',
      [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), sub.id]
    );
    if (sub.plan === 'artist_annual') {
      await pool.execute('UPDATE users SET is_verified = TRUE WHERE id = ?', [req.user.id]);
    }

    res.json({
      status: 'active',
      message: 'Payment confirmed! Your subscription is now active.',
      end_date: endDate.toISOString().slice(0, 10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/webhook (for MTN/Airtel callbacks)
router.post('/webhook', async (req, res) => {
  try {
    const { transaction_ref, status, provider } = req.body;
    if (!transaction_ref) return res.status(400).json({ error: 'Missing transaction ref' });

    const [subs] = await pool.execute('SELECT * FROM subscriptions WHERE transaction_ref = ?', [transaction_ref]);
    if (!subs.length) return res.status(404).json({ error: 'Transaction not found' });
    const sub = subs[0];

    if (status === 'SUCCESSFUL') {
      const startDate = new Date();
      const endDate = new Date();
      const planInfo = PLANS[sub.plan];
      endDate.setMonth(endDate.getMonth() + planInfo.duration_months);

      await pool.execute(
        'UPDATE subscriptions SET status = "active", start_date = ?, end_date = ? WHERE id = ?',
        [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), sub.id]
      );
      if (sub.plan === 'artist_annual') {
        await pool.execute('UPDATE users SET is_verified = TRUE WHERE id = ?', [sub.user_id]);
      }
    } else if (status === 'FAILED') {
      await pool.execute('UPDATE subscriptions SET status = "cancelled" WHERE id = ?', [sub.id]);
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
