const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const COMMISSION_RATE = 0.15; // 15% admin commission on donations

const PLANS = {
  listener_premium: {
    key: 'listener_premium',
    name: 'Listener Premium (Monthly)',
    amount: 5000,
    duration_months: 1,
    currency: 'UGX',
    features: ['Downloads (up to 20/month)', 'Ad-free experience', 'Better audio quality', 'Offline playlists']
  },
  listener_premium_annual: {
    key: 'listener_premium_annual',
    name: 'Listener Premium (Annual)',
    amount: 45000,
    duration_months: 12,
    currency: 'UGX',
    features: ['Everything in monthly', 'Unlimited downloads', '25% savings vs monthly', 'Priority support']
  },
  artist_payment_registration: {
    key: 'artist_payment_registration',
    name: 'Artist Payment Registration',
    amount: 15000,
    duration_months: 0,  // one-time, no expiry
    currency: 'UGX',
    features: ['Register for stream earnings', 'Receive donations', 'Withdraw via MTN/Airtel/Bank', 'Access earnings dashboard']
  }
};

// GET /api/subscriptions/plans
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/subscriptions/my-subscription
router.get('/my-subscription', authenticate, async (req, res) => {
  try {
    const [subs] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.user.id]
    );
    const active = subs.find(s =>
      s.status === 'active' &&
      s.plan !== 'artist_payment_registration' &&
      new Date(s.end_date) >= new Date()
    );
    // Artist payment registration status
    const [ap] = await pool.query(
      'SELECT payment_registered, payment_registered_at FROM artist_profiles WHERE user_id = ?',
      [req.user.id]
    );
    res.json({
      subscriptions: subs,
      active: active || null,
      payment_registered: ap[0]?.payment_registered || false
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/initiate
router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { plan, payment_method, payment_phone, terms_accepted } = req.body;

    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    if (!['mtn','airtel'].includes(payment_method))
      return res.status(400).json({ error: 'Payment method must be MTN or Airtel' });
    if (!payment_phone)
      return res.status(400).json({ error: 'Payment phone number required' });

    // Terms acceptance required for artist payment registration
    if (plan === 'artist_payment_registration') {
      if (!terms_accepted)
        return res.status(400).json({ error: 'You must accept the Terms & Conditions to register for payments' });
      if (req.user.role !== 'artist')
        return res.status(400).json({ error: 'Only artists can register for payment' });
      // Check not already registered
      const [ap] = await pool.query(
        'SELECT payment_registered FROM artist_profiles WHERE user_id = ?', [req.user.id]
      );
      if (ap[0]?.payment_registered)
        return res.status(400).json({ error: 'You are already registered for payments' });
    }

    if ((plan === 'listener_premium' || plan === 'listener_premium_annual') && req.user.role === 'artist')
      return res.status(400).json({ error: 'Artists register for payment, not listener plans' });

    // Validate phone
    const mtnPattern   = /^(0?7[689]\d{7}|2567[689]\d{7})$/;
    const airtelPattern = /^(0?7[012]\d{7}|2567[012]\d{7})$/;
    const phone = payment_phone.replace(/\s/g,'');
    if (payment_method === 'mtn' && !mtnPattern.test(phone))
      return res.status(400).json({ error: 'Invalid MTN number. Format: 0761234567' });
    if (payment_method === 'airtel' && !airtelPattern.test(phone))
      return res.status(400).json({ error: 'Invalid Airtel number. Format: 0701234567' });

    const planInfo = PLANS[plan];
    const transactionRef = `KMM-${Date.now()}-${uuidv4().slice(0,8).toUpperCase()}`;

    const [result] = await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, amount, payment_method, payment_phone, transaction_ref)
       VALUES (?,?,?,?,?,?,?)`,
      [req.user.id, plan, 'pending', planInfo.amount, payment_method, payment_phone, transactionRef]
    );

    // Save terms acceptance
    if (terms_accepted) {
      await pool.query(
        'UPDATE users SET terms_accepted = TRUE, terms_accepted_at = NOW() WHERE id = ?',
        [req.user.id]
      );
    }

    const ussd = payment_method === 'mtn'
      ? `Dial *165*3*${planInfo.amount}*${transactionRef}# to pay`
      : `Dial *185*7*${planInfo.amount}*${transactionRef}# to pay`;

    res.json({
      message: `Payment request sent to ${payment_phone}. Approve the ${payment_method.toUpperCase()} Mobile Money prompt.`,
      transaction_ref: transactionRef,
      subscription_id: result.insertId,
      amount: planInfo.amount,
      instructions: payment_method === 'mtn'
        ? `Check your MTN phone for a prompt. Enter your MoMo PIN to approve UGX ${planInfo.amount.toLocaleString()} for ${planInfo.name}.`
        : `Check your Airtel phone for a prompt. Enter your Airtel Money PIN to approve UGX ${planInfo.amount.toLocaleString()} for ${planInfo.name}.`,
      ussd_code: ussd
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/verify
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { transaction_ref } = req.body;
    const [subs] = await pool.query(
      'SELECT * FROM subscriptions WHERE transaction_ref = ? AND user_id = ?',
      [transaction_ref, req.user.id]
    );
    if (!subs.length) return res.status(404).json({ error: 'Transaction not found' });
    const sub = subs[0];
    if (sub.status === 'active') return res.json({ status: 'active', message: 'Subscription already active' });
    if (sub.status !== 'pending') return res.json({ status: sub.status });

    // Demo: auto-approve after 10 seconds
    const elapsed = Date.now() - new Date(sub.created_at).getTime();
    if (elapsed < 10000) {
      return res.json({ status: 'pending', message: 'Awaiting payment confirmation. Please approve on your phone.' });
    }

    const startDate = new Date();
    const planInfo  = PLANS[sub.plan];

    if (sub.plan === 'artist_payment_registration') {
      // One-time — no end_date, just mark registered
      await pool.query('UPDATE subscriptions SET status = "active" WHERE id = ?', [sub.id]);
      await pool.query(
        'UPDATE artist_profiles SET payment_registered = TRUE, payment_registered_at = NOW() WHERE user_id = ?',
        [req.user.id]
      );
      return res.json({
        status: 'active',
        message: '✅ Payment registration successful! You can now receive earnings and donations.',
        payment_registered: true
      });
    }

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (planInfo?.duration_months || 1));
    await pool.query(
      'UPDATE subscriptions SET status = "active", start_date = ?, end_date = ? WHERE id = ?',
      [startDate.toISOString().slice(0,10), endDate.toISOString().slice(0,10), sub.id]
    );

    res.json({
      status: 'active',
      message: '✅ Payment confirmed! Your subscription is now active.',
      end_date: endDate.toISOString().slice(0,10)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/donate — send donation to an artist
router.post('/donate', authenticate, async (req, res) => {
  try {
    const { artist_uuid, amount, payment_method, payment_phone, message } = req.body;
    if (!artist_uuid || !amount || !payment_method || !payment_phone)
      return res.status(400).json({ error: 'artist_uuid, amount, payment_method, payment_phone required' });

    const donationAmount = parseFloat(amount);
    if (isNaN(donationAmount) || donationAmount < 500)
      return res.status(400).json({ error: 'Minimum donation is UGX 500' });

    const [artists] = await pool.query(
      'SELECT id FROM users WHERE uuid = ? AND role = "artist"', [artist_uuid]
    );
    if (!artists.length) return res.status(404).json({ error: 'Artist not found' });

    // Check artist has payment registration
    const [ap] = await pool.query(
      'SELECT payment_registered FROM artist_profiles WHERE user_id = ?', [artists[0].id]
    );
    if (!ap[0]?.payment_registered)
      return res.status(400).json({ error: 'This artist has not registered for payments yet' });

    const adminCommission = parseFloat((donationAmount * COMMISSION_RATE).toFixed(2));
    const artistAmount    = parseFloat((donationAmount - adminCommission).toFixed(2));
    const transactionRef  = `DON-${Date.now()}-${uuidv4().slice(0,8).toUpperCase()}`;
    const uuid            = uuidv4();

    await pool.query(
      `INSERT INTO donations (uuid, donor_id, artist_id, amount, admin_commission, artist_amount,
        payment_method, payment_phone, transaction_ref, message, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid, req.user.id, artists[0].id, donationAmount, adminCommission, artistAmount,
       payment_method, payment_phone, transactionRef, message || null, 'pending']
    );

    res.json({
      message: `Donation of UGX ${donationAmount.toLocaleString()} initiated. Approve the ${payment_method.toUpperCase()} prompt on your phone.`,
      transaction_ref: transactionRef,
      breakdown: {
        total: donationAmount,
        artist_receives: artistAmount,
        platform_fee: adminCommission,
        fee_percent: '15%'
      },
      instructions: payment_method === 'mtn'
        ? `Enter your MTN MoMo PIN to approve UGX ${donationAmount.toLocaleString()} donation.`
        : `Enter your Airtel Money PIN to approve UGX ${donationAmount.toLocaleString()} donation.`
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/donate/verify
router.post('/donate/verify', authenticate, async (req, res) => {
  try {
    const { transaction_ref } = req.body;
    const [donations] = await pool.query(
      'SELECT * FROM donations WHERE transaction_ref = ?', [transaction_ref]
    );
    if (!donations.length) return res.status(404).json({ error: 'Donation not found' });
    const don = donations[0];
    if (don.status === 'completed') return res.json({ status: 'completed', message: 'Donation already processed' });

    const elapsed = Date.now() - new Date(don.created_at).getTime();
    if (elapsed < 10000) return res.json({ status: 'pending', message: 'Awaiting payment confirmation.' });

    // Mark completed, update artist earnings
    await pool.query('UPDATE donations SET status = "completed" WHERE id = ?', [don.id]);
    const period = new Date().toISOString().slice(0,7);
    await pool.query(
      `INSERT INTO earnings (artist_id, song_id, streams_count, amount, period)
       VALUES (?,0,0,?,?)
       ON DUPLICATE KEY UPDATE amount = amount + ?`,
      [don.artist_id, don.artist_amount, period, don.artist_amount]
    );

    res.json({
      status: 'completed',
      message: `✅ Donation successful! UGX ${don.artist_amount.toLocaleString()} will be credited to the artist.`,
      breakdown: {
        total: don.amount,
        artist_receives: don.artist_amount,
        platform_fee: don.admin_commission
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subscriptions/webhook (MTN/Airtel callback)
router.post('/webhook', async (req, res) => {
  try {
    const { transaction_ref, status } = req.body;
    if (!transaction_ref) return res.status(400).json({ error: 'Missing transaction ref' });

    // Handle subscription webhooks
    if (transaction_ref.startsWith('KMM-')) {
      const [subs] = await pool.query(
        'SELECT * FROM subscriptions WHERE transaction_ref = ?', [transaction_ref]
      );
      if (subs.length && status === 'SUCCESSFUL') {
        const sub = subs[0];
        const planInfo = PLANS[sub.plan];
        if (sub.plan === 'artist_payment_registration') {
          await pool.query('UPDATE subscriptions SET status = "active" WHERE id = ?', [sub.id]);
          await pool.query(
            'UPDATE artist_profiles SET payment_registered = TRUE, payment_registered_at = NOW() WHERE user_id = ?',
            [sub.user_id]
          );
        } else {
          const end = new Date();
          end.setMonth(end.getMonth() + (planInfo?.duration_months || 1));
          await pool.query(
            'UPDATE subscriptions SET status = "active", start_date = CURDATE(), end_date = ? WHERE id = ?',
            [end.toISOString().slice(0,10), sub.id]
          );
        }
      } else if (subs.length && status === 'FAILED') {
        await pool.query('UPDATE subscriptions SET status = "cancelled" WHERE id = ?', [subs[0].id]);
      }
    }

    // Handle donation webhooks
    if (transaction_ref.startsWith('DON-')) {
      const [don] = await pool.query(
        'SELECT * FROM donations WHERE transaction_ref = ?', [transaction_ref]
      );
      if (don.length) {
        if (status === 'SUCCESSFUL') {
          await pool.query('UPDATE donations SET status = "completed" WHERE id = ?', [don[0].id]);
          const period = new Date().toISOString().slice(0,7);
          await pool.query(
            `INSERT INTO earnings (artist_id, song_id, streams_count, amount, period)
             VALUES (?,0,0,?,?) ON DUPLICATE KEY UPDATE amount = amount + ?`,
            [don[0].artist_id, don[0].artist_amount, period, don[0].artist_amount]
          );
        } else {
          await pool.query('UPDATE donations SET status = "failed" WHERE id = ?', [don[0].id]);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
