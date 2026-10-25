# 5 · Build the Pi-hole Ad Blocker

**Difficulty:** beginner · **Time:** ~1.5 hours · **Soldering:** none · **Code:** none, just a few commands

Pi-hole is free, open-source software that blocks ads and trackers for **every device on your home network**: phones, laptops, smart TVs, even apps. It works as your network's DNS server, the "phone book" devices ask before connecting to a website. When something asks for a known ad or tracker address, Pi-hole simply doesn't answer.

This is the gallery project `pi-hole`:

```bash
npm start -- --project pi-hole "raspberry pi zero 2 w, microsd card"
```

![Pi-hole parts](../images/gallery/pi-hole.svg)

---

## Parts

| Part | Qty | Notes |
|---|---|---|
| Raspberry Pi Zero 2 W | 1 | any Raspberry Pi works; a Pi 3/4/5 with an Ethernet cable is even more reliable |
| microSD card, 16 GB+ | 1 | |
| 5 V / 2 A power supply + USB cable | 1 | micro-USB for the Zero 2 W, USB-C for a Pi 4/5 |

You also need: a computer with an SD card slot (or USB adapter), and the login to your home router's admin page.

## Step 1: Flash the SD card

1. Install **Raspberry Pi Imager** from raspberrypi.com/software.
2. Choose your Pi model, then **Raspberry Pi OS (other) → Raspberry Pi OS Lite (64-bit)** (no desktop needed).
3. When it asks to customise settings, set:
   - hostname: `pihole`
   - a username and a strong password
   - your Wi-Fi name and password, and your country
   - **Services → Enable SSH** (password authentication)
4. Write the card.

## Step 2: Boot and log in

Put the card in the Pi, plug in power and wait about two minutes. On your computer (Windows PowerShell, macOS or Linux terminal):

```bash
ssh <your-username>@pihole.local
```

Type `yes` the first time, then your password. You're now typing commands on the Pi.

> `pihole.local` not found? Look up the Pi's IP address in your router's list of connected devices and use `ssh <user>@192.168.x.y` instead.

## Step 3: Give the Pi a fixed address

Your devices will use the Pi as their DNS server, so its address must never change. In your router's admin page, find the Pi in the connected devices list and create a **DHCP reservation** (also called "static lease" or "address reservation"). Note the IP address, for example `192.168.1.53`.

## Step 4: Install Pi-hole

Update the system, then run the official installer:

```bash
sudo apt update && sudo apt full-upgrade -y
curl -sSL https://install.pi-hole.net | bash
```

The installer asks a few questions. The defaults are fine: pick any upstream DNS provider you like (for example Quad9 or Cloudflare), and keep the default blocklist. At the end it shows the web interface address.

> Piping a script from the internet into `bash` runs it with your permissions. The Pi-hole project documents this as its official install method; if you prefer, download the script first and read it before running it.

## Step 5: Set the password and open the dashboard

```bash
sudo pihole setpassword
```

Then open **http://pihole.local/admin** (or `http://<pi-ip>/admin`) in your browser and log in. You'll see the dashboard: total queries, queries blocked, and the percentage blocked.

## Step 6: Point your network at Pi-hole

In your router's **DHCP / LAN settings**, set the **DNS server** to the Pi's IP address. Use it as the *only* DNS server: a second public DNS would let devices go around Pi-hole.

Then reconnect your devices to the Wi-Fi (or turn Wi-Fi off and on), so they pick up the new DNS server.

> Some internet-provider routers don't let you change the DNS. In that case, set the DNS manually on each device you care about (phone and laptop network settings), or turn on Pi-hole's own DHCP server (Settings → DHCP) and switch off the router's. Only do that if you're comfortable with it.

## Step 7: Test

1. Open a news website on your phone: the ad boxes should be empty or gone.
2. On the dashboard, **Total queries** and **Queries blocked** should be climbing.
3. **Query Log** shows every lookup live. Blocked ones are marked.

## Step 8: Tune it

| Situation | What to do |
|---|---|
| A website or app is broken | Query Log → find the blocked domain it needs → **Allow** |
| You want more blocking | Lists → add another well-known blocklist, then run `pihole -g` |
| Pause blocking for a few minutes | Dashboard → **Disable blocking** for 5 minutes |
| Keep it up to date | `pihole -up` (Pi-hole) and `sudo apt full-upgrade` (system), once a month |

## Next steps

- **Ad-Blocker Status Light** (gallery project `pihole-status-light`): an ESP32 and a few LEDs on your shelf that show how much Pi-hole blocks.
- **Home VPN** (gallery project `home-vpn`): use your Pi-hole from anywhere through a WireGuard tunnel.

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing is blocked | The device still uses another DNS: reconnect to Wi-Fi, or check its DNS setting is the Pi's IP |
| No websites load at all | The Pi is off or its IP changed. Check the DHCP reservation, or switch the router's DNS back temporarily |
| `ssh: Could not resolve hostname` | Use the Pi's IP address from the router's device list |
| Dashboard won't open | Use `http://` (not https) and the Pi's IP: `http://192.168.x.y/admin` |

---

**Next:** [6 · Build the RFID Access Lock →](06-build-rfid-lock.md)
