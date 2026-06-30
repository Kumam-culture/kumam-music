// auth.js — Authentication & subscription flows
const Auth = (() => {
  let currentSubPlan        = null;
  let currentTransactionRef = null;
  let timerInterval         = null;
  let _regionsData          = null; // cached {regions, tribes}

  const overlay     = document.getElementById('authOverlay');
  const signInModal = document.getElementById('signInModal');
  const signUpModal = document.getElementById('signUpModal');
  const subModal    = document.getElementById('subscriptionModal');

  // ── Helpers ──────────────────────────────────────────────
  const showOverlay = () => overlay.classList.remove('hidden');
  const hideOverlay = () => {
    overlay.classList.add('hidden');
    [signInModal, signUpModal, subModal].forEach(m => m?.classList.add('hidden'));
    clearPaymentPolling();
  };
  const showSignIn = () => {
    showOverlay();
    signInModal.classList.remove('hidden');
    signUpModal.classList.add('hidden');
    subModal.classList.add('hidden');
  };
  const showSignUp = () => {
    showOverlay();
    signUpModal.classList.remove('hidden');
    signInModal.classList.add('hidden');
    subModal.classList.add('hidden');
    loadRegions();
  };
  const showSubscription = (plan = null, title = 'Complete Payment', desc = '') => {
    showOverlay();
    subModal.classList.remove('hidden');
    signInModal.classList.add('hidden');
    signUpModal.classList.add('hidden');
    document.getElementById('subModalTitle').textContent = title;
    document.getElementById('subModalDesc').textContent  = desc;
    document.getElementById('subModalError').classList.add('hidden');
    document.getElementById('subModalSuccess').classList.add('hidden');
    document.getElementById('subscriptionForm').classList.remove('hidden');
    document.getElementById('paymentPending').classList.add('hidden');
    const termsRow = document.getElementById('termsCheckRow');
    if (termsRow) {
      const isArtistReg = plan === 'artist_payment_registration';
      termsRow.classList.toggle('hidden', !isArtistReg);
      if (isArtistReg) {
        const cb = document.getElementById('subTermsCheck');
        if (cb) cb.checked = false;
      }
    }
    renderPlans(plan);
  };

  // ── Load regions into signup dropdown ────────────────────
  const loadRegions = async () => {
    const regionSel = document.getElementById('signupRegion');
    if (!regionSel || regionSel.options.length > 1) return; // already loaded
    try {
      if (!_regionsData) _regionsData = await API.getRegions();
      const { regions = [] } = _regionsData;
      regions.forEach(r => {
        const opt = document.createElement('option');
        opt.value       = r.id;
        opt.dataset.slug = r.slug;
        opt.textContent = r.name;
        regionSel.appendChild(opt);
      });
    } catch (e) { console.warn('Could not load regions:', e.message); }
  };

  // Region change → populate tribes
  document.getElementById('signupRegion')?.addEventListener('change', async (e) => {
    const regionId   = parseInt(e.target.value);
    const tribeWrap  = document.getElementById('tribeFieldWrap');
    const tribeSel   = document.getElementById('signupTribe');
    const selectedOpt = e.target.options[e.target.selectedIndex];
    const regionSlug = selectedOpt?.dataset?.slug;

    // Clear tribes
    tribeSel.innerHTML = '<option value="">Select your tribe...</option>';

    if (!regionId || !regionSlug) { tribeWrap.style.display = 'none'; return; }

    try {
      if (!_regionsData) _regionsData = await API.getRegions();
      const tribes = (_regionsData.tribes || []).filter(t => t.region_id === regionId);
      tribes.forEach(t => {
        const opt = document.createElement('option');
        opt.value       = t.id;
        opt.textContent = t.name;
        tribeSel.appendChild(opt);
      });
      tribeWrap.style.display = 'block';
    } catch (e) { console.warn('Could not load tribes:', e.message); }
  });

  // ── Phone validation ─────────────────────────────────────
  const validatePhone = (phone, required = false) => {
    if (!phone || phone.trim() === '') {
      return required ? 'Phone number is required' : null;
    }
    const clean = phone.replace(/[\s\-\+]/g, '');
    if (!/^(07\d{8}|2567\d{8})$/.test(clean)) {
      return 'Phone must start with 07 and be 10 digits, e.g. 0761234567';
    }
    return null;
  };

  // Real-time phone validation feedback
  document.getElementById('signupPhone')?.addEventListener('blur', (e) => {
    const err = validatePhone(e.target.value, signUpType === 'artist');
    const small = e.target.nextElementSibling;
    if (err) {
      e.target.style.borderColor = 'var(--red)';
      if (small) { small.textContent = err; small.style.color = 'var(--red)'; }
    } else {
      e.target.style.borderColor = 'var(--green)';
      if (small) {
        small.textContent = 'Valid number ✓';
        small.style.color = 'var(--green)';
      }
    }
  });

  // ── Plan cards ───────────────────────────────────────────
  const renderPlans = (defaultPlan) => {
    const user      = App.getUser();
    const container = document.getElementById('planCards');
    if (!container) return;
    container.innerHTML = '';

    const allPlans = [
      { key: 'listener_premium',            name: 'Listener Premium (Monthly)', amount: 'UGX 5,000/month',  icon: '👑', desc: 'Ad-free, downloads, offline' },
      { key: 'listener_premium_annual',     name: 'Listener Premium (Annual)',  amount: 'UGX 45,000/year', icon: '⭐', desc: 'Best value — 25% savings' },
      { key: 'artist_payment_registration', name: 'Artist Payment Registration',amount: 'UGX 15,000 once',  icon: '🎤', desc: 'Earn royalties & receive donations' },
    ];

    let toShow;
    if (defaultPlan)              toShow = allPlans.filter(p => p.key === defaultPlan);
    else if (user?.role === 'artist') toShow = allPlans.filter(p => p.key === 'artist_payment_registration');
    else                          toShow = allPlans.filter(p => p.key !== 'artist_payment_registration');

    if (toShow.length === 1) currentSubPlan = toShow[0].key;
    else currentSubPlan = defaultPlan || null;

    toShow.forEach(plan => {
      const card = document.createElement('div');
      card.className    = `plan-card ${currentSubPlan === plan.key ? 'selected' : ''}`;
      card.dataset.plan = plan.key;
      card.innerHTML    = `
        <span class="plan-card-icon">${plan.icon}</span>
        <div class="plan-card-info">
          <div class="plan-card-name">${plan.name}</div>
          <div class="plan-card-desc">${plan.desc}</div>
        </div>
        <div class="plan-card-price">${plan.amount}</div>`;
      card.addEventListener('click', () => {
        document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        currentSubPlan = plan.key;
        const tr = document.getElementById('termsCheckRow');
        if (tr) tr.classList.toggle('hidden', plan.key !== 'artist_payment_registration');
      });
      container.appendChild(card);
    });
  };

  // ── Payment polling ──────────────────────────────────────
  const clearPaymentPolling = () => {
    clearInterval(timerInterval);
    timerInterval = null;
    currentTransactionRef = null;
  };
  const startPaymentPolling = (ref) => {
    currentTransactionRef = ref;
    let s = 30;
    timerInterval = setInterval(() => {
      s--;
      const el = document.getElementById('timerCount');
      if (el) el.textContent = s;
      if (s <= 0) clearInterval(timerInterval);
    }, 1000);
    setTimeout(checkPaymentStatus, 12000);
  };
  const checkPaymentStatus = async () => {
    if (!currentTransactionRef) return;
    try {
      const res = await API.verifyPayment(currentTransactionRef);
      if (res.status === 'active') {
        clearPaymentPolling();
        const s = document.getElementById('subModalSuccess');
        if (s) { s.textContent = res.message; s.classList.remove('hidden'); }
        document.getElementById('paymentPending')?.classList.add('hidden');
        try { const me = await API.getMe(); App.setUser(me.user); } catch (e) {}
        App.showNotification('🎉 Payment successful!');
        setTimeout(() => hideOverlay(), 2500);
      }
    } catch (e) { console.warn('Payment check:', e.message); }
  };

  // ── Sign-in form ─────────────────────────────────────────
  document.getElementById('signInForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    const errEl    = document.getElementById('signInError');
    const btn      = document.getElementById('signInSubmit');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Signing in…';
    btn.querySelector('i').classList.remove('hidden');
    try {
      const res = await API.login(email, password);
      localStorage.setItem('kumam_token', res.token);
      hideOverlay();
      App.setUser(res.user);
      App.showNotification(`Welcome back, ${res.user.name.split(' ')[0]}! 👋`);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Sign In';
      btn.querySelector('i').classList.add('hidden');
    }
  });

  // ── Sign-up type toggle ──────────────────────────────────
  let signUpType = 'listener';
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      signUpType = btn.dataset.type;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.artist-field').forEach(f => {
        f.classList.toggle('hidden', signUpType !== 'artist');
      });
      // Phone required indicator
      const req = document.getElementById('phoneRequired');
      if (req) req.classList.toggle('hidden', signUpType !== 'artist');
      if (signUpType === 'artist') loadRegions();
    });
  });

  // ── Sign-up form ─────────────────────────────────────────
  document.getElementById('signUpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name      = document.getElementById('signupName').value.trim();
    const email     = document.getElementById('signupEmail').value.trim();
    const password  = document.getElementById('signupPassword').value;
    const phone     = document.getElementById('signupPhone').value.trim();
    const stageName = document.getElementById('signupStageName').value.trim();
    const regionId  = document.getElementById('signupRegion')?.value || '';
    const tribeId   = document.getElementById('signupTribe')?.value  || '';
    const errEl     = document.getElementById('signUpError');
    const btn       = document.getElementById('signUpSubmit');

    errEl.classList.add('hidden');

    // Client-side phone validation
    const phoneErr = validatePhone(phone, signUpType === 'artist');
    if (phoneErr) {
      errEl.textContent = phoneErr;
      errEl.classList.remove('hidden');
      document.getElementById('signupPhone').focus();
      return;
    }

    // Artist must select region
    if (signUpType === 'artist' && !regionId) {
      errEl.textContent = 'Please select your region';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creating account…';
    btn.querySelector('i').classList.remove('hidden');

    try {
      const res = signUpType === 'artist'
        ? await API.registerArtist({ name, email, password, phone, stage_name: stageName, region_id: regionId, tribe_id: tribeId })
        : await API.register({ name, email, password, phone: phone || undefined });

      localStorage.setItem('kumam_token', res.token);
      hideOverlay();
      App.setUser(res.user);
      App.showNotification(`Welcome to Etokwa Music, ${res.user.name.split(' ')[0]}! 🎵`);

      if (res.requiresSubscription) {
        setTimeout(() => showSubscription(
          'artist_payment_registration',
          'Register for Payments',
          'Pay UGX 15,000 (one-time) to start earning from streams and donations.'
        ), 900);
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Create Account';
      btn.querySelector('i').classList.add('hidden');
    }
  });

  // ── Subscription form ────────────────────────────────────
  document.getElementById('subscriptionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSubPlan) return App.showNotification('Please select a plan', 'error');
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    const paymentPhone  = document.getElementById('paymentPhone').value.trim();
    const errEl         = document.getElementById('subModalError');
    const btn           = document.getElementById('paymentSubmit');

    if (!paymentMethod) { errEl.textContent = 'Select a payment method'; errEl.classList.remove('hidden'); return; }

    // Validate payment phone
    const phoneErr = validatePhone(paymentPhone, true);
    if (phoneErr) { errEl.textContent = phoneErr; errEl.classList.remove('hidden'); return; }

    if (currentSubPlan === 'artist_payment_registration') {
      if (!document.getElementById('subTermsCheck')?.checked) {
        errEl.textContent = 'Please accept the Terms & Conditions to proceed.';
        errEl.classList.remove('hidden'); return;
      }
    }

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Processing…';
    btn.querySelector('i').classList.remove('hidden');

    try {
      const res = await API.initiatePayment({
        plan: currentSubPlan, payment_method: paymentMethod, payment_phone: paymentPhone,
        terms_accepted: currentSubPlan === 'artist_payment_registration'
      });
      document.getElementById('subscriptionForm').classList.add('hidden');
      document.getElementById('paymentPending').classList.remove('hidden');
      document.getElementById('pendingInstructions').textContent = res.instructions;
      startPaymentPolling(res.transaction_ref);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Pay Now';
      btn.querySelector('i').classList.add('hidden');
    }
  });

  document.getElementById('checkPaymentBtn')?.addEventListener('click', checkPaymentStatus);

  // ── Password toggle ──────────────────────────────────────
  document.querySelectorAll('.toggle-pwd').forEach(icon => {
    icon.addEventListener('click', () => {
      const input = icon.previousElementSibling;
      input.type  = input.type === 'password' ? 'text' : 'password';
      icon.className = `fas ${input.type === 'password' ? 'fa-eye' : 'fa-eye-slash'} toggle-pwd`;
    });
  });

  // ── Modal close buttons ──────────────────────────────────
  document.querySelectorAll('.modal-close[data-close]').forEach(btn => {
    btn.addEventListener('click', hideOverlay);
  });
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) hideOverlay(); });
  document.getElementById('toSignUp')?.addEventListener('click', (e) => { e.preventDefault(); showSignUp(); });
  document.getElementById('toSignIn')?.addEventListener('click', (e) => { e.preventDefault(); showSignIn(); });
  document.getElementById('signInBtn')?.addEventListener('click', showSignIn);
  document.getElementById('signUpBtn')?.addEventListener('click', showSignUp);

  return { showSignIn, showSignUp, showSubscription, hideOverlay };
})();
