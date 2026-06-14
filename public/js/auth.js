// auth.js — Authentication & subscription flows
const Auth = (() => {
  let currentSubPlan = null;
  let currentTransactionRef = null;
  let paymentCheckInterval = null;
  let timerInterval = null;

  const overlay = document.getElementById('authOverlay');
  const signInModal = document.getElementById('signInModal');
  const signUpModal = document.getElementById('signUpModal');
  const subModal = document.getElementById('subscriptionModal');

  // Show/hide helpers
  const showOverlay = () => overlay.classList.remove('hidden');
  const hideOverlay = () => {
    overlay.classList.add('hidden');
    [signInModal, signUpModal, subModal].forEach(m => m.classList.add('hidden'));
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
  };

  const showSubscription = (plan = null, title = 'Complete Your Subscription', desc = '') => {
    showOverlay();
    subModal.classList.remove('hidden');
    signInModal.classList.add('hidden');
    signUpModal.classList.add('hidden');
    document.getElementById('subModalTitle').textContent = title;
    document.getElementById('subModalDesc').textContent = desc;
    document.getElementById('subModalError').classList.add('hidden');
    document.getElementById('subModalSuccess').classList.add('hidden');
    document.getElementById('subscriptionForm').classList.remove('hidden');
    document.getElementById('paymentPending').classList.add('hidden');
    renderPlans(plan);
  };

  const renderPlans = async (defaultPlan) => {
    const user = App.getUser();
    const container = document.getElementById('planCards');
    container.innerHTML = '';

    const plans = [
      { key: 'listener_premium', name: 'Listener Premium', amount: 'UGX 5,000/month', desc: 'Downloads, offline, ad-free', icon: '🎵' },
      { key: 'artist_annual', name: 'Artist Annual', amount: 'UGX 15,000/year', desc: 'Upload songs, earn from streams', icon: '🎤' },
    ];

    const filtered = user?.role === 'artist'
      ? plans.filter(p => p.key === 'artist_annual')
      : user?.role === 'listener'
        ? plans.filter(p => p.key === 'listener_premium')
        : plans;

    filtered.forEach(plan => {
      const card = document.createElement('div');
      card.className = `plan-card ${defaultPlan === plan.key ? 'selected' : ''}`;
      card.dataset.plan = plan.key;
      card.innerHTML = `
        <span class="plan-card-icon">${plan.icon}</span>
        <div class="plan-card-info">
          <div class="plan-card-name">${plan.name}</div>
          <div class="plan-card-desc">${plan.desc}</div>
        </div>
        <div class="plan-card-price">${plan.amount}</div>
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        currentSubPlan = plan.key;
      });
      container.appendChild(card);
    });

    if (defaultPlan) currentSubPlan = defaultPlan;
    else if (filtered.length === 1) currentSubPlan = filtered[0].key;
  };

  const clearPaymentPolling = () => {
    clearInterval(paymentCheckInterval);
    clearInterval(timerInterval);
    paymentCheckInterval = null;
    timerInterval = null;
  };

  const startPaymentPolling = (transactionRef) => {
    currentTransactionRef = transactionRef;
    let seconds = 30;

    timerInterval = setInterval(() => {
      seconds--;
      const el = document.getElementById('timerCount');
      if (el) el.textContent = seconds;
      if (seconds <= 0) clearInterval(timerInterval);
    }, 1000);

    // Auto-check after 12 seconds
    setTimeout(() => checkPaymentStatus(), 12000);
  };

  const checkPaymentStatus = async () => {
    if (!currentTransactionRef) return;
    try {
      const res = await API.verifyPayment(currentTransactionRef);
      if (res.status === 'active') {
        clearPaymentPolling();
        const successEl = document.getElementById('subModalSuccess');
        successEl.textContent = res.message;
        successEl.classList.remove('hidden');
        document.getElementById('paymentPending').classList.add('hidden');

        // Refresh user data
        try {
          const meRes = await API.getMe();
          App.setUser(meRes.user);
        } catch (e) {}

        App.showNotification('🎉 Subscription activated successfully!');
        setTimeout(() => hideOverlay(), 2500);
      } else if (res.status === 'pending') {
        // keep waiting
      }
    } catch (e) {
      console.warn('Payment check error:', e);
    }
  };

  // ─── SIGN IN FORM ───────────────────────────────────────
  document.getElementById('signInForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    const errEl = document.getElementById('signInError');
    const btn = document.getElementById('signInSubmit');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Signing in…';
    btn.querySelector('i').classList.remove('hidden');

    try {
      const res = await API.login(email, password);
      localStorage.setItem('kumam_token', res.token);
      App.setUser(res.user);
      hideOverlay();
      App.showNotification(`Welcome back, ${res.user.name.split(' ')[0]}! 👋`);
      App.updateNavForUser(res.user);

      // Redirect artists who need subscription
      if (res.user.role === 'artist' && !res.user.subscription) {
        setTimeout(() => showSubscription('artist_annual', 'Activate Artist Account', 'Pay UGX 15,000/year to start uploading and earning.'), 800);
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Sign In';
      btn.querySelector('i').classList.add('hidden');
    }
  });

  // ─── SIGN UP FORM ───────────────────────────────────────
  let signUpType = 'listener';

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      signUpType = btn.dataset.type;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.artist-field').forEach(f => {
        f.classList.toggle('hidden', signUpType !== 'artist');
      });
    });
  });

  document.getElementById('signUpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const phone = document.getElementById('signupPhone').value.trim();
    const stageName = document.getElementById('signupStageName').value.trim();
    const errEl = document.getElementById('signUpError');
    const btn = document.getElementById('signUpSubmit');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creating account…';
    btn.querySelector('i').classList.remove('hidden');

    try {
      let res;
      if (signUpType === 'artist') {
        res = await API.registerArtist({ name, email, password, phone, stage_name: stageName });
      } else {
        res = await API.register({ name, email, password, phone });
      }

      localStorage.setItem('kumam_token', res.token);
      App.setUser(res.user);
      App.updateNavForUser(res.user);
      hideOverlay();
      App.showNotification(`Welcome to Kumam Music, ${res.user.name.split(' ')[0]}! 🎵`);

      if (res.requiresSubscription) {
        setTimeout(() => showSubscription('artist_annual', 'Activate Your Artist Account', 'Pay UGX 15,000/year to start uploading music and earning from streams.'), 800);
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

  // ─── SUBSCRIPTION FORM ──────────────────────────────────
  document.getElementById('subscriptionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSubPlan) return App.showNotification('Please select a plan', 'error');

    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    const paymentPhone = document.getElementById('paymentPhone').value.trim();
    const errEl = document.getElementById('subModalError');
    const btn = document.getElementById('paymentSubmit');

    if (!paymentMethod) { errEl.textContent = 'Please select a payment method'; errEl.classList.remove('hidden'); return; }
    if (!paymentPhone) { errEl.textContent = 'Please enter your mobile money number'; errEl.classList.remove('hidden'); return; }

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Processing…';
    btn.querySelector('i').classList.remove('hidden');

    try {
      const res = await API.initiatePayment({ plan: currentSubPlan, payment_method: paymentMethod, payment_phone: paymentPhone });

      // Show pending UI
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

  document.getElementById('checkPaymentBtn')?.addEventListener('click', () => checkPaymentStatus());

  // ─── MODAL CLOSE BUTTONS ────────────────────────────────
  document.querySelectorAll('.modal-close[data-close]').forEach(btn => {
    btn.addEventListener('click', () => hideOverlay());
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideOverlay();
  });

  // ─── SWITCH LINKS ───────────────────────────────────────
  document.getElementById('toSignUp').addEventListener('click', (e) => { e.preventDefault(); showSignUp(); });
  document.getElementById('toSignIn').addEventListener('click', (e) => { e.preventDefault(); showSignIn(); });

  // ─── TOP BAR BUTTONS ────────────────────────────────────
  document.getElementById('signInBtn').addEventListener('click', showSignIn);
  document.getElementById('signUpBtn').addEventListener('click', showSignUp);

  // ─── LOGOUT ─────────────────────────────────────────────
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('kumam_token');
    App.setUser(null);
    App.updateNavForUser(null);
    App.navigate('home');
    App.showNotification('Signed out successfully');
    document.getElementById('userDropdown').classList.add('hidden');
  });

  // ─── USER DROPDOWN ──────────────────────────────────────
  document.getElementById('userAvatarBtn').addEventListener('click', () => {
    document.getElementById('userDropdown').classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenu');
    if (!menu.contains(e.target)) {
      document.getElementById('userDropdown').classList.add('hidden');
    }
  });

  // ─── PASSWORD TOGGLE ────────────────────────────────────
  document.querySelectorAll('.toggle-pwd').forEach(icon => {
    icon.addEventListener('click', () => {
      const input = icon.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
      icon.className = `fas ${input.type === 'password' ? 'fa-eye' : 'fa-eye-slash'} toggle-pwd`;
    });
  });

  // ─── DROPDOWN NAV LINKS ─────────────────────────────────
  document.querySelectorAll('.user-dropdown a[data-page]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('userDropdown').classList.add('hidden');
      App.navigate(a.dataset.page);
    });
  });

  return { showSignIn, showSignUp, showSubscription, hideOverlay };
})();
