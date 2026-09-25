/**
 * MARO CONSULTORES — MESA CUANTITATIVA & TRADING CON IA
 * SISTEMA DE AUTENTICACIÓN INSTITUCIONAL & CONTROL DE ACCESO
 * ==========================================================
 * Credenciales Iniciales Predeterminadas:
 *   - Usuario:    admin
 *   - Contraseña: Maro2026!
 */

(function () {
  'use strict';

  // Configuración de Seguridad y Credenciales
  const AUTH_CONFIG = {
    // SHA-256 de "admin" (en minúsculas)
    userHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    // SHA-256 de "Maro2026!"
    passHash: "b8a2822f9946dd73121b298e579e77318d3dacb14e5146665cf9f2663233f23b",
    // Respaldo en texto plano para entornos sin soporte crypto.subtle
    fallbackUser: "admin",
    fallbackPass: "Maro2026!",
    sessionKey: "maro_auth_session_v1",
    sessionDurationMs: 30 * 24 * 60 * 60 * 1000 // 30 días
  };

  // Función auxiliar de hashing SHA-256 compatible con navegadores modernos
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

  // Verificar si ya existe una sesión válida guardada
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

  // Guardar sesión
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

  // Cerrar sesión
  function clearSession() {
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
    sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
  }

  // Validar credenciales ingresadas
  async function checkCredentials(user, pass) {
    const cleanUser = (user || '').trim().toLowerCase();
    const cleanPass = (pass || '').trim();

    if (!cleanUser || !cleanPass) return false;

    if (window.crypto && crypto.subtle) {
      const uHash = await sha256(cleanUser);
      const pHash = await sha256(cleanPass);
      return (uHash === AUTH_CONFIG.userHash && pHash === AUTH_CONFIG.passHash);
    } else {
      return (cleanUser === AUTH_CONFIG.fallbackUser && cleanPass === AUTH_CONFIG.fallbackPass);
    }
  }

  // Inicializar interfaz y listeners cuando cargue el DOM
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

    // 1. Verificar estado inicial
    if (isAuthenticated()) {
      if (overlay) overlay.classList.add('hidden');
      if (appCont) appCont.classList.remove('blurred');
    } else {
      if (overlay) overlay.classList.remove('hidden');
      if (appCont) appCont.classList.add('blurred');
      setTimeout(() => { if (userInp) userInp.focus(); }, 150);
    }

    // 2. Alternar visualización de contraseña (ver/ocultar)
    if (toggleEye && passInp) {
      toggleEye.addEventListener('click', () => {
        const isPass = passInp.type === 'password';
        passInp.type = isPass ? 'text' : 'password';
        if (eyeIcon) eyeIcon.textContent = isPass ? '🙈' : '👁️';
      });
    }

    // 3. Manejo del Submit de Login
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
          // Éxito: retroalimentación visual inmediata
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
          // Error: animación de vibración y alerta
          if (btnSubmit) btnSubmit.disabled = false;
          if (btnText) btnText.textContent = 'INGRESAR A LA BITÁCORA';

          if (errorText) errorText.textContent = 'Usuario o contraseña incorrectos.';
          if (errorBox) {
            errorBox.style.display = 'flex';
            errorBox.classList.remove('shake');
            void errorBox.offsetWidth; // trigger reflow
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

    // 4. Botón Cerrar Sesión (Logout)
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

  // Ejecutar tan pronto como el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }

  // Exponer objeto global para inspección o cambio de credenciales
  window.MaroAuth = {
    isAuthenticated,
    clearSession
  };
})();
