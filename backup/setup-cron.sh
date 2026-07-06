#!/usr/bin/env bash
set -euo pipefail

CORDLYX_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$CORDLYX_DIR/backup/backup.sh"
LOG_DIR="$CORDLYX_DIR/backups"
MARKER_START="# cordlyx-backup-start"
MARKER_END="# cordlyx-backup-end"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info() { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }
log()      { echo "  $1"; }

mkdir -p "$LOG_DIR"

# ── systemd ──────────────────────────────────────────────────

SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_NAME="cordlyx-backup"

install_systemd() {
    mkdir -p "$SYSTEMD_USER_DIR"

    cat > "$SYSTEMD_USER_DIR/$SERVICE_NAME.service" <<SERVICEEOF
[Unit]
Description=CordLyx backup
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=$SCRIPT
WorkingDirectory=$CORDLYX_DIR
StandardOutput=append:$LOG_DIR/cron.log
StandardError=append:$LOG_DIR/cron.log
SERVICEEOF

    cat > "$SYSTEMD_USER_DIR/$SERVICE_NAME.timer" <<TIMEREOF
[Unit]
Description=Daily CordLyx backup (with catch-up on boot)

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
TIMEREOF

    systemctl --user daemon-reload
    systemctl --user enable --now "$SERVICE_NAME.timer"

    log_ok "Systemd timer installed"
    log ""
    log "Schedule:  daily at midnight (system default)"
    log "Catch-up:  runs missed backup on next boot (Persistent=true)"
    log "Logs:      $LOG_DIR/cron.log"
    log ""
    log "To inspect: systemctl --user list-timers | grep $SERVICE_NAME"
    log "To trigger: systemctl --user start $SERVICE_NAME.service"
    log "To remove:  $0 --uninstall"
}

uninstall_systemd() {
    systemctl --user disable --now "$SERVICE_NAME.timer" 2>/dev/null || true
    rm -f "$SYSTEMD_USER_DIR/$SERVICE_NAME.service" "$SYSTEMD_USER_DIR/$SERVICE_NAME.timer"
    systemctl --user daemon-reload
    log_ok "Systemd timer removed"
}

# ── cron ─────────────────────────────────────────────────────

CRON_ENTRIES="$MARKER_START
# Daily full backup at 3:00 AM
0 3 * * * cd $CORDLYX_DIR && $SCRIPT >> \"$LOG_DIR/cron.log\" 2>&1
# Cleanup backups older than 14 days at 4:00 AM
0 4 * * * cd $CORDLYX_DIR && $SCRIPT --cleanup >> \"$LOG_DIR/cron.log\" 2>&1
$MARKER_END"

install_cron() {
    local tmp; tmp=$(mktemp)
    crontab -l 2>/dev/null | sed "/$MARKER_START/,/$MARKER_END/d" > "$tmp" || true
    echo "" >> "$tmp"
    echo "$CRON_ENTRIES" >> "$tmp"
    crontab "$tmp"
    rm -f "$tmp"
    log_ok "Crontab installed"
    log ""
    log "Schedule:"
    log "  Daily backup ........... 3:00 AM  → $LOG_DIR/cron.log"
    log "  Cleanup (14 days) ...... 4:00 AM  → $LOG_DIR/cron.log"
    log ""
    log "NOTE: cron does NOT catch up missed jobs after shutdown."
    log "      Consider systemd mode: $0 --systemd"
    log ""
    log "To verify: crontab -l"
    log "To run immediately: $SCRIPT"
    log "To remove: $0 --uninstall"
}

uninstall_cron() {
    local tmp; tmp=$(mktemp)
    crontab -l 2>/dev/null | sed "/$MARKER_START/,/$MARKER_END/d" > "$tmp" || true
    crontab "$tmp"
    rm -f "$tmp"
    log_ok "CordLyx entries removed from crontab"
}

# ── detect ───────────────────────────────────────────────────

has_systemd() {
    command -v systemctl &>/dev/null && systemctl --user list-units &>/dev/null 2>&1
}

# ── main ─────────────────────────────────────────────────────

case "${1:-}" in
    --systemd)
        install_systemd
        ;;
    --cron)
        install_cron
        ;;
    --uninstall|-u)
        uninstall_systemd
        uninstall_cron
        ;;
    --help|-h)
        echo "CordLyx Backup Scheduler"
        echo ""
        echo "Usage:"
        echo "  $0                Auto-detect and install (systemd → cron)"
        echo "  $0 --systemd      Force systemd user timer (recommended)"
        echo "  $0 --cron         Force cron (legacy)"
        echo "  $0 --uninstall    Remove all CordLyx scheduled tasks"
        echo "  $0 --help         Show this help"
        echo ""
        echo "CORDLYX_DIR=$CORDLYX_DIR"
        echo "SCRIPT=$SCRIPT"
        echo ""
        if has_systemd; then
            echo "Detected: systemd — recommended mode (supports catch-up on boot)"
        else
            echo "Detected: cron fallback (no catch-up on boot)"
        fi
        ;;
    *)
        # auto-detect: prefer systemd
        if has_systemd; then
            install_systemd
        else
            install_cron
        fi
        ;;
esac
