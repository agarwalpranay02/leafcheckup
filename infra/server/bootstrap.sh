#!/usr/bin/env bash
# Harden a fresh Ubuntu 24.04 VPS and prepare it to run LeafCheckup.
# Run once as root:  curl -fsSL <raw url>/infra/server/bootstrap.sh | bash -s -- <your-ssh-public-key>
#
# What it does
#  - creates a 'deploy' user with your SSH key; disables root login and passwords
#  - firewall (UFW): SSH open, HTTP/HTTPS only from Cloudflare's edge IPs
#  - fail2ban for SSH, unattended security upgrades, kernel/network hardening
#  - installs Docker Engine + compose plugin, nightly DB backup cron
set -euo pipefail
PUBKEY="${1:?usage: bootstrap.sh '<ssh-ed25519 AAAA... you@laptop>'}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades jq

# --- deploy user ---
id deploy &>/dev/null || adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "$PUBKEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
echo "deploy ALL=(ALL) NOPASSWD:/usr/bin/systemctl,/usr/bin/docker" > /etc/sudoers.d/deploy

# --- SSH hardening ---
cat > /etc/ssh/sshd_config.d/10-leafcheckup.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
AllowUsers deploy
CONF
systemctl restart ssh || systemctl restart sshd

# --- firewall: web traffic only via Cloudflare ---
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment 'ssh (rate limited)'
for net in $(curl -fsSL https://www.cloudflare.com/ips-v4) $(curl -fsSL https://www.cloudflare.com/ips-v6); do
  ufw allow proto tcp from "$net" to any port 80,443 comment 'cloudflare'
  ufw allow proto udp from "$net" to any port 443 comment 'cloudflare http3'
done
ufw --force enable

# --- fail2ban ---
cat > /etc/fail2ban/jail.d/sshd.local <<'CONF'
[sshd]
enabled = true
maxretry = 4
findtime = 10m
bantime = 1h
CONF
systemctl enable --now fail2ban

# --- automatic security updates ---
dpkg-reconfigure -f noninteractive unattended-upgrades

# --- kernel / network hardening ---
cat > /etc/sysctl.d/99-leafcheckup.conf <<'CONF'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
CONF
sysctl --system >/dev/null

# --- Docker ---
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
cat > /etc/docker/daemon.json <<'CONF'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" }, "no-new-privileges": true, "live-restore": true }
CONF
systemctl restart docker
usermod -aG docker deploy

# --- app directory + backups ---
install -d -o deploy -g deploy /opt/leafcheckup /opt/leafcheckup/backups
echo "15 2 * * * deploy /opt/leafcheckup/backup.sh >> /opt/leafcheckup/backups/backup.log 2>&1" > /etc/cron.d/leafcheckup-backup

echo "Done. Next: copy infra/prod/* to /opt/leafcheckup, create /opt/leafcheckup/.env, then 'docker compose up -d' as deploy."
