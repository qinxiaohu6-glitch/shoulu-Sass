#!/usr/bin/env python3
"""Transactional email — the part of the submission flow that was silent.

Until now a submitter got nothing at all: no acknowledgement, no "you're live",
no reason when rejected. Every message here is optional — if `data/mail.json`
is missing or incomplete, `send()` returns False and the caller carries on. A
directory must not lose a submission because an SMTP password is wrong.

Config (data/mail.json, chmod 600 — it holds a password):

    {
      "host": "smtp.example.com",
      "port": 587,
      "user": "noreply@example.com",
      "password": "…",
      "sender": "Product Atlas <noreply@example.com>",
      "starttls": true
    }

Port 465 (implicit TLS) is detected and uses SMTP_SSL instead.
"""

import json
import os
import smtplib
import ssl
import sys
import threading
from email.message import EmailMessage
from email.utils import formataddr, formatdate

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "data", "mail.json")

_cache = {"mtime": None, "cfg": None}


def config():
    try:
        mtime = os.path.getmtime(CONFIG)
    except OSError:
        return None
    if _cache["mtime"] == mtime:
        return _cache["cfg"]
    try:
        with open(CONFIG, encoding="utf-8") as fh:
            raw = json.load(fh)
    except (OSError, ValueError):
        raw = None
    cfg = None
    if isinstance(raw, dict) and raw.get("host") and raw.get("sender"):
        cfg = raw
    _cache.update({"mtime": mtime, "cfg": cfg})
    return cfg


def configured():
    return config() is not None


def _deliver(to, subject, body):
    cfg = config()
    if not cfg:
        return False
    msg = EmailMessage()
    msg["From"] = cfg["sender"]
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg.set_content(body)
    host = cfg["host"]
    port = int(cfg.get("port") or 587)
    timeout = float(cfg.get("timeout") or 8)
    try:
        if port == 465:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, timeout=timeout, context=ctx) as smtp:
                if cfg.get("user"):
                    smtp.login(cfg["user"], cfg.get("password") or "")
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=timeout) as smtp:
                smtp.ehlo()
                if cfg.get("starttls", True):
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                if cfg.get("user"):
                    smtp.login(cfg["user"], cfg.get("password") or "")
                smtp.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001 - mail must never break a request
        sys.stderr.write("mail to %s failed: %r\n" % (to, exc))
        return False


def send(to, subject, body):
    """Fire and forget. The SMTP round trip must not block an HTTP response."""
    to = (to or "").strip()
    if not to or "@" not in to:
        return False
    if not configured():
        return False
    t = threading.Thread(target=_deliver, args=(to, subject, body), daemon=True)
    t.start()
    return True


# --------------------------------------------------------------------------
# messages — plain text, because a plain-text mail always renders
# --------------------------------------------------------------------------
def submitted(rec, site="Product Atlas"):
    name = rec.get("name") or "your listing"
    status = ("We have your payment request" if rec.get("awaiting_payment")
              else "It is in the review queue")
    return (
        "Thanks — we received %s.\n\n"
        "%s. Free listings are usually reviewed in 7–14 days; that is not "
        "guaranteed, and busy periods can take longer. Paid placements go "
        "live the same day the site owner confirms the payment.\n\n"
        "You can follow it here: %s/settings/submissions.html\n\n"
        "— %s\n"
        % (name, status, site.rstrip("/"), site)
    )


def approved(rec, site="Product Atlas"):
    slug = rec.get("slug") or ""
    return (
        "%s is live.\n\n"
        "Page: %s/tools/%s.html\n\n"
        "The link to your site is included on that page. If anything looks "
        "wrong, reply to this mail and we will fix it.\n\n"
        "— %s\n"
        % (rec.get("name") or "Your listing", site.rstrip("/"), slug, site)
    )


def rejected(rec, note="", site="Product Atlas"):
    reason = ("\nReason: %s\n" % note) if note else ""
    return (
        "%s was not published.\n%s\n"
        "You can edit it and submit again: %s/settings/submissions.html\n\n"
        "— %s\n"
        % (rec.get("name") or "Your submission", reason, site.rstrip("/"), site)
    )


def payment_confirmed(rec, site="Product Atlas"):
    slug = rec.get("slug") or ""
    return (
        "Payment received — %s is live.\n\n"
        "Page: %s/tools/%s.html\n\n"
        "Your placement runs for the period shown at checkout. When it ends "
        "the page stays up; only the pinned position goes away.\n\n"
        "— %s\n"
        % (rec.get("name") or "Your listing", site.rstrip("/"), slug, site)
    )
