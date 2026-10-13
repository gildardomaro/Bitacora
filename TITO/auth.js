/**
 * MARO CONSULTORES — MESA CUANTITATIVA & TRADING CON IA
 * PORTAL PRIVADO DE CLIENTE: TITO (PEPPERSTONE-03)
 * ==========================================================
 * Credenciales de Acceso:
 *   - Usuario:    tito
 *   - Contraseña: Tito2026!
 *   (Acceso Maestro: admin / Maro2026!)
 */

(function () {
  'use strict';

  // Configuración de Seguridad y Credenciales para TITO
  const AUTH_CONFIG = {
    validUsers: [
      {
        // tito / Tito2026!
        userHash: "504db5aeeabd937a18a36b62d6e948d236b889b33c84e9e0561d7fda1c145bce",
        passHash: "aaa0ac4d63a624279c71dc8cd4bb7920e8b80b10a0f257a2cad9991a34269b38",
        fallbackUser: "tito",
        fallbackPass: "Tito2026!"
      },
      {
        // admin / Maro2026!
        userHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
        passHash: "b8a2822f9946dd73121b298e579e77318d3dacb14e5146665cf9f2663233f23b",
        fallbackUser: "admin",
        fallbackPass: "Maro2026!"
      }
    ],
    sessionKey: "maro_auth_session_tito_v1",
    sessionDurationMs: 30 * 24 * 60 * 60 * 1000 // 30 días
  };

  async function sha256(text) {
    if (window.crypto && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return text;
  }

  function isAuthenticated() {
    const raw = localStorage.getItem(AUTH_CONFIG.sessionKey) || sessionStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!raw) return false;
    try {
      const session = JSON.parse(raw);
      if (session && session.authenticated === true) {
        if (Date.now() - session.timestamp < AUTH_CONFIG.sessionDurationMs) {
          return true;
        }
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  function saveSession(username, rememberMe) {
    const sessionData = JSON.stringify({
      authenticated: true,
      user: username,
      timestamp: Date.now()
    });

    if (rememberMe) {
      localStorage.setItem(AUTH_CONFIG.sessionKey, sessionData);
    } else {
      sessionStorage.setItem(AUTH_CONFIG.sessionKey, sessionData);
    }
  }

  function clearSession() {
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
    sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
  }

  async function checkCredentials(user, pass) {
    const cleanUser = (user || '').trim().toLowerCase();
    const cleanPass = (pass || '').trim();

    if (!cleanUser || !cleanPass) return false;

    if (window.crypto && crypto.subtle) {
      const uHash = await sha256(cleanUser);
      const pHash = await sha256(cleanPass);
      return AUTH_CONFIG.validUsers.some(entry => entry.userHash === uHash && entry.passHash === pHash);
    } else {
      return AUTH_CONFIG.validUsers.some(entry => entry.fallbackUser === cleanUser && entry.fallbackPass === cleanPass);
    }
  }

  function initAuth() {
    const overlay   = document.getElementById('loginOverlay');
    const form      = document.getElementById('loginForm');
    const userInp   = document.getElementById('loginUser');
    const passInp   = document.getElementById('loginPass');
    const remember  = document.getElementById('chkRememberMe');
    const errorBox  = document.getElementById('loginErrorMsg');
    const errorText = document.getElementById('loginErrorText');
    const btnSubmit = document.getElementById('btnLoginSubmit');
    const btnText   = document.getElementById('loginBtnText');
    const toggleEye = document.getElementById('btnTogglePassword');
    const eyeIcon   = document.getElementById('eyeIcon');
    const appCont   = document.querySelector('.app-container');
    const btnLogout = document.getElementById('btnLogout');

    if (isAuthenticated()) {
      if (overlay) overlay.classList.add('hidden');
      if (appCont) appCont.classList.remove('blurred');
    } else {
      if (overlay) overlay.classList.remove('hidden');
      if (appCont) appCont.classList.add('blurred');
      setTimeout(() => { if (userInp) userInp.focus(); }, 150);
    }

    if (toggleEye && passInp) {
      toggleEye.addEventListener('click', () => {
        const isPass = passInp.type === 'password';
        passInp.type = isPass ? 'text' : 'password';
        if (eyeIcon) eyeIcon.textContent = isPass ? '🙈' : '👁️';
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorBox) errorBox.style.display = 'none';

        const userVal = userInp ? userInp.value : '';
        const passVal = passInp ? passInp.value : '';
        const remVal  = remember ? remember.checked : true;

        if (btnSubmit) btnSubmit.disabled = true;
        if (btnText) btnText.textContent = 'VERIFICANDO...';

        const isValid = await checkCredentials(userVal, passVal);

        if (isValid) {
          if (btnSubmit) {
            btnSubmit.classList.add('success');
            btnSubmit.style.background = 'linear-gradient(135deg, #00E676, #00C853)';
          }
          if (btnText) btnText.textContent = '✓ ACCESO CONCEDIDO';

          saveSession(userVal, remVal);

          setTimeout(() => {
            if (overlay) {
              overlay.classList.add('fade-out');
              setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('fade-out');
              }, 350);
            }
            if (appCont) appCont.classList.remove('blurred');
            if (passInp) passInp.value = '';
            if (btnSubmit) {
              btnSubmit.disabled = false;
              btnSubmit.classList.remove('success');
              btnSubmit.style.background = '';
            }
            if (btnText) btnText.textContent = 'INGRESAR A LA BITÁCORA';
          }, 450);
        } else {
          if (btnSubmit) btnSubmit.disabled = false;
          if (btnText) btnText.textContent = 'INGRESAR A LA BITÁCORA';

          if (errorText) errorText.textContent = 'Usuario o contraseña incorrectos.';
          if (errorBox) {
            errorBox.style.display = 'flex';
            errorBox.classList.remove('shake');
            void errorBox.offsetWidth;
            errorBox.classList.add('shake');
          }

          const card = document.getElementById('loginCard');
          if (card) {
            card.classList.remove('shake-card');
            void card.offsetWidth;
            card.classList.add('shake-card');
          }

          if (passInp) {
            passInp.value = '';
            passInp.focus();
          }
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        if (appCont) appCont.classList.add('blurred');
        if (overlay) {
          overlay.classList.remove('hidden');
          overlay.style.opacity = '1';
        }
        if (passInp) passInp.value = '';
        if (errorBox) errorBox.style.display = 'none';
        setTimeout(() => { if (userInp) userInp.focus(); }, 150);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }

  window.MaroAuth = {
    isAuthenticated,
    clearSession
  };
})();
