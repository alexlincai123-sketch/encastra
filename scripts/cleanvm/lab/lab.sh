#!/usr/bin/env bash
# Clean VM lab: a Windows 11 client VM under QEMU/KVM, driven from Linux (WSL2 on the development
# machine, or any Linux host with /dev/kvm).
#
#   lab.sh build-base                 install Windows from the ISO into base/ (the CLEAN_BASELINE)
#   lab.sh cycle NAME HARNESS_DIR     boot a throwaway overlay of the base with HARNESS_DIR as a CD,
#                                     wait for the guest to finish and power off, extract results
#
# The base image is never booted again after it is built: every cycle runs on a fresh qcow2
# overlay backed by it, with its own copy of the UEFI variables and the TPM state. Restoring the
# snapshot is therefore "make a new overlay", and a cycle cannot leave anything behind for the next.
#
# Environment: LAB (default /srv/encastra-vm), ISO (default $LAB/iso/win11-ent-eval-26200.iso),
# MEM (MiB, default 4096), CPUS (default 4), TIMEOUT (seconds a cycle may take, default 10800).
set -euo pipefail

LAB=${LAB:-/srv/encastra-vm}
ISO=${ISO:-$LAB/iso/win11-ent-eval-26200.iso}
MEM=${MEM:-4096}
CPUS=${CPUS:-4}
TIMEOUT=${TIMEOUT:-10800}
# The VM clock is the real time (RTC=utc). An earlier attempt pinned it inside what looked like
# the evaluation window; the licence stayed in notification state anyway, because the evaluation
# had never been activated - it needs the network once, which the base build now gives it.
RTC=${RTC:-utc}
# Network: the base build may reach the internet (activation); a cycle may not (restrict=on: the
# guest reaches nothing outside the VM, so nothing it does depends on, or leaks to, the network).
NET_RESTRICT=${NET_RESTRICT:-on}
HERE=$(cd "$(dirname "$0")" && pwd)
# Not the Secure Boot build: its SMM mode does not survive nested KVM under Hyper-V (WSL2) on this
# AMD host ("KVM: entry failed, hardware error 0xffffffff" with SMM=1). Secure Boot is therefore
# off in the VM and Windows Setup is told not to require it (autounattend.xml, LabConfig).
OVMF_CODE=/usr/share/OVMF/OVMF_CODE_4M.fd
OVMF_VARS_MS=/usr/share/OVMF/OVMF_VARS_4M.fd

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR $*"; exit 1; }

start_tpm() { # $1 = dir holding the TPM state
  mkdir -p "$1"
  swtpm socket --tpmstate dir="$1" --ctrl type=unixio,path="$1/sock" --tpm2 --terminate --daemon \
    --log file="$1/swtpm.log"
  for _ in $(seq 50); do [ -S "$1/sock" ] && return 0; sleep 0.1; done
  die "swtpm socket did not appear in $1"
}

# qemu_run DIR DISK [extra args...] - boots and returns when QEMU exits.
qemu_run() {
  local dir=$1 disk=$2; shift 2
  qemu-system-x86_64 -enable-kvm -machine q35,smm=off \
    -cpu host,-svm,hv_relaxed,hv_vapic,hv_spinlocks=0x1fff,hv_time,hv_vpindex,hv_synic,hv_stimer \
    -smp "$CPUS" -m "$MEM" \
    -rtc base="$RTC",clock=host,driftfix=slew \
    -drive if=pflash,format=raw,unit=0,readonly=on,file="$OVMF_CODE" \
    -drive if=pflash,format=raw,unit=1,file="$dir/vars.fd" \
    -chardev socket,id=chrtpm,path="$dir/tpm/sock" -tpmdev emulator,id=tpm0,chardev=chrtpm \
    -device tpm-tis,tpmdev=tpm0 \
    -device ahci,id=ahci \
    -drive id=disk0,file="$disk",if=none,format=qcow2,cache=unsafe -device ide-hd,drive=disk0,bus=ahci.0,bootindex=1 \
    -netdev user,id=n0,restrict="$NET_RESTRICT" -device e1000e,netdev=n0 \
    -device qemu-xhci -device usb-tablet \
    -vga std -display none \
    -monitor unix:"$dir/monitor.sock",server,nowait \
    -serial file:"$dir/serial.log" \
    -name "cleanvm-$(basename "$dir")" \
    "$@"
}

mon() { # $1 dir, rest = monitor command
  local dir=$1; shift
  { printf '%s\n' "$*"; sleep 1; } | socat - UNIX-CONNECT:"$dir/monitor.sock" >/dev/null 2>&1 || true
}

screenshot() { # $1 dir, $2 name
  mkdir -p "$1/shots"
  mon "$1" "screendump $1/shots/$2.ppm"
  sleep 1
  [ -f "$1/shots/$2.ppm" ] && python3 -c "
from PIL import Image; import sys
Image.open(sys.argv[1]).save(sys.argv[2]); import os; os.remove(sys.argv[1])" "$1/shots/$2.ppm" "$1/shots/$2.png" 2>/dev/null || true
}

build_base() {
  local B=$LAB/base
  [ -e "$B/base.qcow2" ] && die "$B/base.qcow2 exists; move it away to rebuild"
  [ -f "$ISO" ] || die "no ISO at $ISO"
  mkdir -p "$B/unattend/agent"
  cp "$HERE/autounattend.xml" "$B/unattend/"
  cp "$HERE/agent/bootstrap.ps1" "$B/unattend/agent/"
  sed 's/\r*$/\r/' "$HERE/agent/provision.cmd" > "$B/unattend/agent/provision.cmd"
  xorriso -as mkisofs -quiet -J -R -V UNATTEND -o "$B/unattend.iso" "$B/unattend"
  qemu-img create -q -f qcow2 "$B/base.qcow2" 64G
  cp "$OVMF_VARS_MS" "$B/vars.fd"
  start_tpm "$B/tpm"
  NET_RESTRICT=off
  log "installing Windows into $B/base.qcow2 (VM clock $RTC, network restrict=$NET_RESTRICT, link down until provisioning asks)"
  # The network card starts with its link DOWN. Windows Setup and OOBE with a working network run
  # the online "zero-day patch" step, which failed ("Something went wrong - OOBEZDP") and stopped the
  # unattended OOBE. With no link they take the offline path. provision.cmd (first logon) writes
  # PROVISION-NETWORK to COM1 when it wants the network for activation; the link comes up then.
  #
  # The Microsoft UEFI CD boot loader waits for a key press; press one for the first 12 s only.
  # Longer, and the keys land in Windows Setup itself: a space on its focused Cancel button asked
  # "Are you sure you want to quit?" in one build (the default answer, No, saved it).
  ( until [ -S "$B/monitor.sock" ]; do sleep 0.2; done
    mon "$B" "set_link n0 off"
    for i in $(seq 12); do sleep 1; mon "$B" "sendkey spc"; done
    ( until grep -aq PROVISION-NETWORK "$B/serial.log" 2>/dev/null; do sleep 5; done
      for _ in 1 2 3 4 5; do mon "$B" "set_link n0 on"; sleep 2; done   # the monitor takes one client at a time
      log "provisioning asked for the network: link up" ) &
    while [ -S "$B/monitor.sock" ]; do sleep 120; screenshot "$B" "install-$(date -u +%H%M%S)"; done ) &
  local pump=$!
  qemu_run "$B" "$B/base.qcow2" \
    -drive id=cd0,file="$ISO",if=none,media=cdrom,readonly=on -device ide-cd,drive=cd0,bus=ahci.1,bootindex=0 \
    -drive id=cd1,file="$B/unattend.iso",if=none,media=cdrom,readonly=on -device ide-cd,drive=cd1,bus=ahci.2
  kill "$pump" 2>/dev/null || true
  grep -q . "$B/serial.log" 2>/dev/null || true
  chmod a-w "$B/base.qcow2" "$B/vars.fd"
  ( cd "$B" && sha256sum base.qcow2 vars.fd > base.sha256 && tar -C tpm -cf tpm.tar --exclude=sock --exclude=swtpm.log . )
  log "base built: $(cat "$B/base.sha256" | tr '\n' ' ')"
}

make_results_disk() { # $1 path
  truncate -s 1G "$1"
  printf 'label: dos\nstart=2048, type=c\n' | sfdisk -q "$1"
  mkfs.vfat -F 32 -n CLEANVM_R --offset 2048 "$1" >/dev/null
}

cycle() {
  local name=$1 harness=$2 B=$LAB/base C=$LAB/cycles/$1
  [ -f "$B/base.sha256" ] || die "no finished base image"
  [ -d "$harness" ] || die "no harness dir $harness"
  [ -e "$C" ] && die "$C exists; cycles are never reused"
  # One VM at a time: two would share the host's memory and each other's timings.
  pgrep -f -- "-name cleanvm-" >/dev/null && die "another cleanvm VM is already running"
  ( cd "$B" && sha256sum -c --quiet base.sha256 ) || die "base image does not match base.sha256"
  mkdir -p "$C/tpm"
  qemu-img create -q -f qcow2 -F qcow2 -b "$B/base.qcow2" "$C/overlay.qcow2"
  cp "$B/vars.fd" "$C/vars.fd"; chmod u+w "$C/vars.fd"
  tar -C "$C/tpm" -xf "$B/tpm.tar"
  make_results_disk "$C/results.img"
  xorriso -as mkisofs -quiet -J -joliet-long -R -V CLEANVM_H -o "$C/harness.iso" "$harness"
  ( cd "$harness" && find . -type f -print0 | sort -z | xargs -0 sha256sum ) > "$C/harness.sha256"
  cp "$B/base.sha256" "$C/base.sha256"
  cp "$harness/plan.json" "$harness/expected.json" "$harness/harness-manifest.json" "$C/"
  start_tpm "$C/tpm"
  log "cycle $name: booting overlay of CLEAN_BASELINE"
  ( n=0; while [ ! -S "$C/monitor.sock" ]; do sleep 1; done
    while [ -S "$C/monitor.sock" ]; do sleep 30; n=$((n+1)); screenshot "$C" "t$(printf %04d $n)"; done ) &
  local pump=$!
  qemu_run "$C" "$C/overlay.qcow2" \
    -drive id=cd0,file="$C/harness.iso",if=none,media=cdrom,readonly=on -device ide-cd,drive=cd0,bus=ahci.1 \
    -drive id=res,file="$C/results.img",if=none,format=raw -device ide-hd,drive=res,bus=ahci.2 &
  local qpid=$!
  ( sleep "$TIMEOUT"; kill -TERM "$qpid" 2>/dev/null && echo timeout > "$C/timed-out" ) &
  local guard=$!
  set +e; wait "$qpid"; local rc=$?; set -e
  kill "$pump" "$guard" 2>/dev/null || true
  echo "$rc" > "$C/qemu.exit"
  [ -f "$C/timed-out" ] && log "cycle $name: TIMEOUT after ${TIMEOUT}s (the VM was killed)"
  mkdir -p "$C/results"
  mcopy -s -n -i "$C/results.img@@1M" ::/ "$C/results/" 2>/dev/null || log "cycle $name: results disk unreadable"
  log "cycle $name: qemu exit $rc; results in $C/results"
}

case "${1:-}" in
  build-base) build_base ;;
  cycle) [ $# -eq 3 ] || die "usage: lab.sh cycle NAME HARNESS_DIR"; cycle "$2" "$3" ;;
  *) sed -n '2,15p' "$0"; exit 2 ;;
esac
