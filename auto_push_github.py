"""
AUTO PUSH GITHUB — MARO CONSULTORES
====================================
Genera static_data.js desde MT5 y hace git push al repo gildardomaro/Bitacora.
Ejecución blindada contra colisiones de procesos, estados huérfanos de Git y micro-cortes.
"""

import os
import sys
import subprocess
import time
import datetime
import json
import shutil
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Configuración ─────────────────────────────────────────────────────────────
BOT_DIR    = os.path.dirname(os.path.abspath(__file__))
DASH_DIR   = os.path.join(BOT_DIR, "dashboard")
STATIC_JS  = os.path.join(DASH_DIR, "static_data.js")
LOCK_FILE  = os.path.join(BOT_DIR, ".auto_push.lock")
INTERVAL   = 5 * 60           # 5 minutos en segundos (300s)
GIT_REMOTE = "origin"
GIT_BRANCH = "main"
# ──────────────────────────────────────────────────────────────────────────────

def log(msg: str):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        print(f"[{ts}] {msg}", flush=True)
    except Exception:
        safe_msg = msg.encode('ascii', errors='replace').decode('ascii')
        print(f"[{ts}] {safe_msg}", flush=True)


class SingleInstanceLock:
    """Barrera contra procesos superpuestos o duplicados."""
    def __init__(self, lock_file=LOCK_FILE):
        self.lock_file = lock_file
        self.handle = None

    def acquire(self) -> bool:
        try:
            import msvcrt
            self.handle = open(self.lock_file, "a+")
            msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            self.handle.seek(0)
            self.handle.truncate()
            self.handle.write(f"{os.getpid()}\n{datetime.datetime.now().isoformat()}\n")
            self.handle.flush()
            return True
        except (IOError, OSError, PermissionError):
            if self.handle:
                try:
                    self.handle.close()
                except Exception:
                    pass
                self.handle = None
            return False

    def release(self):
        if self.handle:
            try:
                import msvcrt
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
                self.handle.close()
            except Exception:
                pass
            self.handle = None
            try:
                if os.path.exists(self.lock_file):
                    os.remove(self.lock_file)
            except Exception:
                pass


def get_git_cmd() -> str:
    """Obtiene el comando o ruta completa de git."""
    user_home = os.path.expanduser("~")
    cand1 = os.path.join(user_home, "AppData", "Local", "Programs", "Git", "cmd", "git.exe")
    if os.path.isfile(cand1):
        return cand1
    cand2 = r"C:\Program Files\Git\cmd\git.exe"
    if os.path.isfile(cand2):
        return cand2
    return "git"


def run_git(args: list, cwd: str = BOT_DIR) -> tuple[int, str, str]:
    """Ejecuta un comando git y devuelve (returncode, stdout, stderr)."""
    git_bin = get_git_cmd()
    try:
        result = subprocess.run(
            [git_bin] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=90
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        log(f"⚠️ Git timeout (90s) ejecutando: git {' '.join(args[:3])}")
        return 1, "", "Git timeout expired"
    except Exception as ex:
        log(f"⚠️ Excepción ejecutando git: {ex}")
        return 1, "", str(ex)


def repair_git_state():
    """Barrera de auto-sanación: Detecta y remueve locks huérfanos, carpetas de rebase atascadas
    y configura flags resilientes para ejecuciones desatendidas."""
    git_dir = os.path.join(BOT_DIR, ".git")
    if not os.path.isdir(git_dir):
        return

    # 1. Eliminar locks huérfanos generados por caídas o OneDrive
    lock_items = [
        os.path.join(git_dir, "index.lock"),
        os.path.join(git_dir, "HEAD.lock"),
        os.path.join(git_dir, "refs", "heads", "main.lock"),
        os.path.join(git_dir, "rebase-merge"),
        os.path.join(git_dir, "rebase-apply")
    ]
    for li in lock_items:
        if os.path.isfile(li):
            try:
                os.remove(li)
                log(f"🧹 [BARRERA ACTIVA] Lock huérfano eliminado: {os.path.basename(li)}")
            except Exception as e:
                log(f"Aviso eliminando {li}: {e}")
        elif os.path.isdir(li):
            try:
                shutil.rmtree(li, ignore_errors=True)
                log(f"🧹 [BARRERA ACTIVA] Carpeta de rebase atascada eliminada: {os.path.basename(li)}")
            except Exception as e:
                log(f"Aviso eliminando carpeta {li}: {e}")

    # 2. Si git está en rebase o merge residual, abortarlo limpiamente
    try:
        run_git(["rebase", "--abort"])
    except Exception:
        pass
    try:
        run_git(["merge", "--abort"])
    except Exception:
        pass

    # 3. Forzar configuraciones no-interactivas para evitar prompts
    run_git(["config", "core.autocrlf", "false"])
    run_git(["config", "pull.rebase", "false"])
    run_git(["config", "core.fileMode", "false"])


def ensure_git_repo():
    """Inicializa y verifica la salud del repositorio."""
    git_dir = os.path.join(BOT_DIR, ".git")
    if not os.path.isdir(git_dir):
        log("Repo git no encontrado. Inicializando...")
        rc, out, err = run_git(["init", "-b", "main"])
        if rc != 0:
            run_git(["init"])
            run_git(["checkout", "-b", "main"])
        log(f"git init: {out or err}")

        run_git(["remote", "add", GIT_REMOTE, "https://github.com/gildardomaro/Bitacora.git"])
        log("Descargando historial existente del repo...")
        run_git(["pull", "--no-edit", "-X", "ours", GIT_REMOTE, GIT_BRANCH])
    else:
        repair_git_state()


def sync_mt5_data():
    """Extrae datos de MT5 y regenera static_data.js.
    Si el servidor local (puerto 8080) está arriba se apoya en él; de lo contrario invoca
    directamente el extractor de MT5 con timeout corto de sondeo."""
    import urllib.request
    try:
        with urllib.request.urlopen("http://127.0.0.1:8080/api/sync", timeout=1.5) as r:
            body = r.read().decode()
            log(f"API local /api/sync respondio con éxito.")
            return True
    except Exception:
        # Servidor no disponible (comportamiento normal en background) -> extracción directa MT5
        try:
            from dashboard_server import sync_all_data_from_mt5
            ok = sync_all_data_from_mt5()
            if ok:
                log("Datos MT5 extraídos y static_data.js regenerado con éxito directamente.")
                return True
            else:
                log("Aviso: sync_all_data_from_mt5 retornó False.")
        except Exception as ex_sync:
            log(f"Error ejecutando sync_all_data_from_mt5: {ex_sync}")
    return False


def atomic_write(filepath: str, content: str):
    """Escritura atómica con archivo temporal para evitar que el navegador
    o Git lean un archivo a medio escribir o truncado."""
    tmp_path = filepath + f".tmp_{os.getpid()}"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, filepath)
    except Exception as e:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        raise e


def add_timestamp_to_static_data():
    """Inyecta/actualiza el campo generated_at en todos los static_data.js (Maestro, HR y TITO)."""
    ts = datetime.datetime.utcnow().isoformat() + "Z"
    new_field = f'  "generated_at": "{ts}",'

    static_targets = [
        STATIC_JS,
        os.path.join(BOT_DIR, "static_data.js"),
        os.path.join(BOT_DIR, "HR", "static_data.js"),
        os.path.join(DASH_DIR, "HR", "static_data.js"),
        os.path.join(BOT_DIR, "TITO", "static_data.js"),
        os.path.join(DASH_DIR, "TITO", "static_data.js")
    ]

    for st in static_targets:
        if os.path.isfile(st):
            try:
                with open(st, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                if '"generated_at":' in content or 'generated_at:' in content:
                    content = re.sub(r'  "?generated_at"?: ".*?",', new_field, content)
                else:
                    content = content.replace(
                        "window.STATIC_DASHBOARD_DATA = {",
                        f"window.STATIC_DASHBOARD_DATA = {{\n{new_field}",
                        1
                    )
                atomic_write(st, content)
            except Exception as e:
                log(f"Aviso actualizando timestamp en {st}: {e}")

    log(f"Timestamp inyectado en todos los dashboards: {ts}")


def sync_files_to_root():
    """Copia los archivos actualizados del dashboard y subcarpetas (HR, TITO)
    para que GitHub Pages muestre exactamente los mismos datos en tiempo real."""
    files_to_copy = [
        "static_data.js",
        "index.html",
        "app.js",
        "auth.js",
        "styles.css",
        "chart.umd.min.js",
        "lightweight-charts.standalone.production.js",
        "logo_maro.jpg"
    ]
    for fn in files_to_copy:
        src = os.path.join(DASH_DIR, fn)
        dst = os.path.join(BOT_DIR, fn)
        if os.path.isfile(src):
            try:
                shutil.copy2(src, dst)
            except Exception as e:
                log(f"Error copiando {fn} a la raíz: {e}")

    # Sincronizar subcarpetas HR y TITO
    for sub in ["HR", "TITO"]:
        sub_src = os.path.join(DASH_DIR, sub)
        sub_dst = os.path.join(BOT_DIR, sub)
        if os.path.isdir(sub_src):
            os.makedirs(sub_dst, exist_ok=True)
            for fn in files_to_copy:
                f_s = os.path.join(sub_src, fn)
                f_d = os.path.join(sub_dst, fn)
                if os.path.isfile(f_s):
                    try:
                        shutil.copy2(f_s, f_d)
                    except Exception:
                        pass

    log("Archivos del dashboard y portales /HR y /TITO sincronizados a la raíz (GitHub Pages root).")


def git_push():
    """Stage -> Commit -> Fetch & Safe Merge -> Push al repositorio de GitHub."""
    repair_git_state()
    sync_files_to_root()

    # Stage selectivo de archivos de visualización
    files_to_stage = [
        "dashboard/",
        "index.html",
        "static_data.js",
        "app.js",
        "auth.js",
        "styles.css",
        "chart.umd.min.js",
        "lightweight-charts.standalone.production.js",
        "logo_maro.jpg",
        "HR/",
        "TITO/",
        "radar/",
        "radar_data_cache.json",
        "VER_DASHBOARD_LOCAL.html"
    ]
    
    # Filtrar solo archivos que existen realmente
    valid_stage = [f for f in files_to_stage if os.path.exists(os.path.join(BOT_DIR, f))]
    rc, out, err = run_git(["add"] + valid_stage)
    if rc != 0:
        log(f"Error en git add: {err}")
        return False

    # Status de los archivos staged
    rc, out, _ = run_git(["diff", "--cached", "--name-only"])
    if not out:
        log("Sin cambios de datos pendientes de commit en dashboard/ ni raíz.")
        # Verificar si hay commits previos no pusheados
        rc_rev, out_rev, _ = run_git(["rev-list", f"{GIT_REMOTE}/{GIT_BRANCH}..HEAD", "--count"])
        if rc_rev == 0 and out_rev.isdigit() and int(out_rev) > 0:
            log(f"Encontrados {out_rev} commit(s) locales pendientes de push.")
        else:
            return True

    if out:
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        msg = f"Auto-update: datos de trading {ts}"
        rc, out, err = run_git(["commit", "-m", msg])
        if rc != 0:
            log(f"Error en git commit: {err}")
            return False
        log(f"Commit creado: {msg}")

    # Sincronizar cambios remotos sin rebase destructivo
    run_git(["fetch", GIT_REMOTE, GIT_BRANCH])
    rc_merge, out_merge, err_merge = run_git([
        "merge", f"{GIT_REMOTE}/{GIT_BRANCH}",
        "-m", "Merge remote-tracking branch [auto-sync]",
        "-X", "ours",
        "--no-edit"
    ])
    if rc_merge != 0:
        log(f"Aviso en merge remoto: {err_merge or out_merge}. Auto-sanando...")
        repair_git_state()

    # Push
    log(f"Pusheando a {GIT_REMOTE}/{GIT_BRANCH}...")
    rc, out, err = run_git(["push", GIT_REMOTE, GIT_BRANCH])
    if rc != 0:
        log(f"Primer push rechazado ({err}). Reintentando con reconciliación rápida...")
        repair_git_state()
        run_git(["fetch", GIT_REMOTE, GIT_BRANCH])
        run_git(["merge", f"{GIT_REMOTE}/{GIT_BRANCH}", "-m", "Merge remote retry", "-X", "ours", "--no-edit"])
        rc, out, err = run_git(["push", GIT_REMOTE, GIT_BRANCH])
        if rc != 0:
            log(f"Error en git push: {err}")
            return False

    log("Push exitoso. Dashboard disponible en: https://gildardomaro.github.io/Bitacora")
    return True


def run_once():
    """Ejecuta un ciclo protegido con barrera de exclusión mutua."""
    lock = SingleInstanceLock()
    if not lock.acquire():
        log("🔒 [BARRERA ACTIVA] Ya existe otra instancia de auto_push_github en ejecución. Omitiendo turno.")
        return

    try:
        log("=" * 60)
        log("INICIANDO CICLO DE PUBLICACION Y AUDITORIA (BLINDADO)")
        log("=" * 60)
        # Barrera de seguridad: Sanitizar terminal.ini para evitar modo segundo plano en MT5
        try:
            from guard_terminals_gui import sanitize_all_terminals
            res = sanitize_all_terminals()
            log(f"Auditoría visual de terminales MT5: {res}")
        except Exception as ex_guard:
            log(f"Aviso en guard_terminals_gui: {ex_guard}")

        ensure_git_repo()
        sync_mt5_data()
        add_timestamp_to_static_data()
        git_push()
        log("CICLO COMPLETADO EXITOSAMENTE")
        log("")
    finally:
        lock.release()


def run_watch():
    """Corre en bucle cada INTERVAL segundos."""
    log(f"Modo WATCH activado — publicando cada {INTERVAL//60} minutos.")
    log("Presiona Ctrl+C para detener.")
    while True:
        run_once()
        next_run = datetime.datetime.now() + datetime.timedelta(seconds=INTERVAL)
        log(f"Próxima publicación: {next_run.strftime('%H:%M:%S')}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    if "--watch" in sys.argv:
        run_watch()
    else:
        run_once()
