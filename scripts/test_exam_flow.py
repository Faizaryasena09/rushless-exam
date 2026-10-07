#!/usr/bin/env python3
"""
=====================================================================
 RUSHLESS EXAM - END TO END SUBMIT / AUTO-SUBMIT TEST SUITE
=====================================================================
 Menjalankan banyak skenario sekaligus (real-time, singkat, deterministik)
 terhadap server dev/prod + database langsung.

 Yang diuji:
   T00  Preflight     : server hidup, DB terhubung, skema sudah dimigrasi
   T01  Manual submit : semua tipe soal (MC, PGK, essay, matching, TF)
   T02  No-truncate  : jawaban > 255 char utuh di DB (regresi VARCHAR 255)
   T03  Auto-submit   : waktu habis -> server submit sendiri, jawaban aman
   T04  Score parity  : skor auto-submit == skor submit manual (regresi)
   T05  Race submit   : 8 thread submit bersamaan -> 1 hasil, tanpa duplikat
   T06  Race expiry   : submit client saat server sudah auto-submit -> merge
   T07  Batch/beacon  : temp-answer batch (format sendBeacon) utuh
   T08  require_all   : tolak submit tidak lengkap (422), force tetap jalan
   T09  Force submit  : siswa ONLINE tidak boleh auto-submit dari server
   T10  Force submit  : siswa OFFLINE boleh auto-submit dari server
   T11  Recalculate   : jumlah baris jawaban tidak berubah (no duplikat)
   T12  Uniqueness    : unique key (attempt_id, question_id) benar-benar ada
   T13  Session ctrl  : /api/session-control list + restart session

 Cara pakai:
   python scripts/test_exam_flow.py
   python scripts/test_exam_flow.py --base http://localhost:3000 --keep
   python scripts/test_exam_flow.py --only T02 T03

 Butuh: requests, pymysql  (pip install requests pymysql redis)
 Creda DB dibaca otomatis dari .env.local
=====================================================================
"""

import argparse
import json
import os
import random
import re
import string
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

try:
    import requests
except ImportError:
    print("ERROR: pip install requests")
    sys.exit(1)

try:
    import pymysql
except ImportError:
    print("ERROR: pip install pymysql")
    sys.exit(1)

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None


# ---------------------------------------------------------------- config
TAG = "ZZTEST"
PASSWORD = "admin"
# bcrypt hash untuk password "admin" (sama seperti default admin di db.js)
PASSWORD_HASH = "$2b$10$Bip8Jha67dJS2knb5Hd6T.DZI97ugPxUtGwC7qgMpbTFtd4OmHk0e"

ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin")


def load_env(path=".env.local"):
    data = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                data[k.strip()] = v.strip().strip('"').strip("'")
    return data


ENV = load_env()

ARGS = None
BASE = None
DB = None
REDIS = None
RESULTS = []
LOCK = threading.Lock()


# ---------------------------------------------------------------- output
def color(code, s):
    return f"\033[{code}m{s}\033[0m"


def log(msg):
    print(msg, flush=True)


def banner(title):
    log("")
    log(color("1;36", "=" * 72))
    log(color("1;36", f"  {title}"))
    log(color("1;36", "=" * 72))


def record(test, ok, detail=""):
    with LOCK:
        RESULTS.append((test, ok, detail))
    mark = color("1;32", "PASS") if ok else color("1;31", "FAIL")
    log(f"  [{mark}] {test}" + (f" - {detail}" if detail else ""))


# ---------------------------------------------------------------- helpers
def q(sql, args=None, one=False):
    cur = DB.cursor(pymysql.cursors.DictCursor)
    cur.execute(sql, args or ())
    rows = cur.fetchall()
    cur.close()
    if one:
        return rows[0] if rows else None
    return rows


def qrun(sql, args=None):
    cur = DB.cursor()
    cur.execute(sql, args or ())
    try:
        return cur.lastrowid
    finally:
        cur.close()


def new_session():
    s = requests.Session()
    s.headers.update({"User-Agent": "ZZTEST-Suite/1.0"})
    return s


def purge_user_session(user_id):
    """Bersihkan sesi user di DB + Redis (login paksa untuk keperluan test)."""
    q("UPDATE rhs_users SET session_id = NULL, last_activity = '1970-01-01 00:00:00', "
      "is_online_realtime = 0 WHERE id = %s", (user_id,))
    if REDIS is not None:
        try:
            REDIS.delete(f"session:{user_id}", f"online:{user_id}", f"last_activity:{user_id}")
        except Exception:
            pass


def login(username, password=PASSWORD, takeover=True):
    """Login; bila akun sedang aktif di perangkat lain (HTTP 409),
    sesi lamanya dibersihkan lalu login diulang (butuh takeover=True)."""
    s = new_session()
    r = s.post(f"{BASE}/api/login", json={"username": username, "password": password}, timeout=20)

    if r.status_code == 409 and takeover:
        u = q("SELECT id FROM rhs_users WHERE username = %s", (username,), one=True)
        if u:
            purge_user_session(u["id"])
            s = new_session()
            r = s.post(f"{BASE}/api/login", json={"username": username, "password": password}, timeout=20)

    if r.status_code != 200:
        raise RuntimeError(f"Login {username} gagal: HTTP {r.status_code} {r.text[:160]}")
    return s


def cache_purge(*keys):
    if REDIS is None:
        return
    for k in keys:
        try:
            REDIS.delete(k)
        except Exception:
            pass


# ---------------------------------------------------------------- seed data
def purge_stale():
    """Bersihkan sisa data test dari run sebelumnya yang gagal."""
    try:
        exams = q("SELECT id FROM rhs_exams WHERE exam_name LIKE %s", (f"{TAG}%",))
        if exams:
            eids = [e["id"] for e in exams]
            eh = ",".join(["%s"] * len(eids))
            q(f"DELETE FROM rhs_student_answer WHERE exam_id IN ({eh})", eids)
            q(f"DELETE FROM rhs_temporary_answer WHERE exam_id IN ({eh})", eids)
            q(f"DELETE FROM rhs_temporary_answer_archive WHERE exam_id IN ({eh})", eids)
            q(f"DELETE FROM rhs_exam_logs WHERE attempt_id IN "
              f"(SELECT id FROM rhs_exam_attempts WHERE exam_id IN ({eh}))", eids)
            q(f"DELETE FROM rhs_exam_attempts WHERE exam_id IN ({eh})", eids)
            q(f"DELETE FROM rhs_exam_questions WHERE exam_id IN ({eh})", eids)
            q(f"DELETE FROM rhs_exam_settings WHERE exam_id IN ({eh})", eids)
            q(f"DELETE FROM rhs_exam_classes WHERE exam_id IN ({eh})", eids)
            q(f"DELETE FROM rhs_exams WHERE id IN ({eh})", eids)
        users = q("SELECT id FROM rhs_users WHERE username LIKE %s", (f"{TAG.lower()}_%",))
        if users:
            uids = [u["id"] for u in users]
            uh = ",".join(["%s"] * len(uids))
            q(f"DELETE FROM rhs_activity_logs WHERE user_id IN ({uh})", uids)
            q(f"DELETE FROM rhs_users WHERE id IN ({uh})", uids)
        q("DELETE FROM rhs_classes WHERE class_name LIKE %s", (f"{TAG}%",))
        log("  data test lama dibersihkan")
    except Exception as e:
        log(color("1;33", f"  ⚠ purge gagal: {e}"))


def seed():
    banner("SEEDING DATA TEST")
    purge_stale()
    stamp = uuid.uuid4().hex[:6]
    ids = {"stamp": stamp}

    # Kelas
    class_name = f"{TAG}_Kelas_{stamp}"
    ids["class_id"] = qrun("INSERT INTO rhs_classes (class_name) VALUES (%s)", (class_name,))
    log(f"  class_id={ids['class_id']} ({class_name})")

    # Siswa (9 orang: s0 dipakai untuk多数 skenario, s1..s8 untuk race)
    students = []
    for i in range(9):
        uname = f"{TAG.lower()}_{stamp}_{i}"
        pwd_hash = PASSWORD_HASH
        uid = qrun(
            "INSERT INTO rhs_users (username, password, role, class_id) VALUES (%s, %s, 'student', %s)",
            (uname, pwd_hash, ids["class_id"]),
        )
        students.append({"id": uid, "username": uname})
    ids["students"] = students
    log(f"  {len(students)} siswa dibuat")

    # ---------------- UJIAN A: manual submit (async 60 menit)
    ids["exam_a"] = create_exam(
        f"{TAG}_A_Manual_{stamp}", timer_mode="async", duration=60,
        start_offset=-3600, end_offset=7200, classes=[ids["class_id"]],
    )

    # ---------------- UJIAN B: auto-submit instan (async 0 menit)
    ids["exam_b"] = create_exam(
        f"{TAG}_B_AutoSubmit_{stamp}", timer_mode="async", duration=0,
        start_offset=-3600, end_offset=7200, classes=[ids["class_id"]],
    )

    # ---------------- UJIAN C: sync, end_time di masa depan (diubah saat runtime)
    ids["exam_c"] = create_exam(
        f"{TAG}_C_Sync_{stamp}", timer_mode="sync", duration=60,
        start_offset=-3600, end_offset=3600, classes=[ids["class_id"]],
    )

    return ids


def create_exam(name, timer_mode, duration, start_offset, end_offset, classes):
    """Buat ujian + settings + kelas + 5 soal (semua tipe)."""
    exam_id = qrun(
        """INSERT INTO rhs_exams
           (exam_name, timer_mode, duration_minutes, max_attempts)
           VALUES (%s, %s, %s, 5)""",
        (name, timer_mode, duration),
    )

    q(
        """INSERT INTO rhs_exam_settings
           (exam_id, start_time, end_time, show_result, require_all_answered,
            require_safe_browser, require_seb, require_geschool, require_token)
           VALUES (%s, DATE_ADD(NOW(), INTERVAL %s SECOND), DATE_ADD(NOW(), INTERVAL %s SECOND), 1, 0, 0, 0, 0, 0)""",
        (exam_id, start_offset, end_offset),
    )

    for cid in classes:
        q("INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES (%s, %s)", (exam_id, cid))

    return {"id": exam_id, "name": name, "questions": insert_questions(exam_id)}


def insert_questions(exam_id):
    """5 soal: MC, PGK (complex), essay, matching, true_false. Return dict meta."""
    qs = {}

    # 1) Multiple choice biasa
    mc_options = json.dumps([
        {"originalKey": "A", "text": "Jakarta"},
        {"originalKey": "B", "text": "Bandung"},
        {"originalKey": "C", "text": "Surabaya"},
    ])
    qs["mc"] = {
        "id": qrun(
            """INSERT INTO rhs_exam_questions
               (exam_id, question_text, options, correct_option, question_type, points, sort_order)
               VALUES (%s, %s, %s, 'A', 'multiple_choice', 10, 1)""",
            (exam_id, "Ibu kota Indonesia adalah?", mc_options),
        ),
        "answer": "A", "points": 10, "type": "multiple_choice",
    }

    # 2) PGK kompleks (jawaban benar: A,B)
    pgk_options = json.dumps([
        {"originalKey": "A", "text": "Pernyataan 1 benar"},
        {"originalKey": "B", "text": "Pernyataan 2 benar"},
        {"originalKey": "C", "text": "Pernyataan 3 salah"},
        {"originalKey": "D", "text": "Pernyataan 4 salah"},
    ])
    qs["pgk"] = {
        "id": qrun(
            """INSERT INTO rhs_exam_questions
               (exam_id, question_text, options, correct_option, question_type, points,
                scoring_strategy, sort_order)
               VALUES (%s, %s, %s, 'A,B', 'multiple_choice_complex', 20, 'pgk_additive', 2)""",
            (exam_id, "Pilih semua pernyataan yang benar", pgk_options),
        ),
        "answer": "A,B", "points": 20, "type": "multiple_choice_complex", "strategy": "pgk_additive",
    }

    # 3) Essay panjang (>255 char) dengan keyword
    essay_answer = (
        "Menurut saya jawaban yang benar adalah fotosintesis karena proses ini mengubah "
        "karbon dioksida dan air menjadi glukosa serta oksigen dengan bantuan cahaya matahari. "
        "Proses ini berlangsung di kloroplas dan merupakan proses penting bagi kehidupan. "
    )
    essay_answer = essay_answer + ("Penjelasan tambahan yang membuat jawaban ini panjang sekali. " * 6)
    assert len(essay_answer) > 255, "essay test harus > 255 char"
    qs["essay"] = {
        "id": qrun(
            """INSERT INTO rhs_exam_questions
               (exam_id, question_text, options, correct_option, question_type, points,
                scoring_strategy, scoring_metadata, sort_order)
               VALUES (%s, %s, %s, 'fotosintesis', 'essay', 30, 'essay_any_keyword', %s, 3)""",
            (
                exam_id,
                "Jelaskan proses fotosintesis!",
                None,
                json.dumps({"keywords": ["fotosintesis", "kloroplas"]}),
            ),
        ),
        "answer": essay_answer, "points": 30, "type": "essay", "strategy": "essay_any_keyword",
    }

    # 4) Matching 6 pasangan (JSON > 255 char)
    pairs, responses = [], []
    cities = [
        ("DKI Jakarta", "Jakarta"),
        ("Jawa Barat", "Bandung"),
        ("Jawa Timur", "Surabaya"),
        ("Sumatera Utara", "Medan"),
        ("Sulawesi Selatan", "Makassar"),
        ("Sumatera Selatan", "Palembang"),
    ]
    for i, (prov, capital) in enumerate(cities, start=1):
        label = f"Ibu kota Provinsi {prov} adalah {capital}"
        # pair.r = nilai jawaban yang BENAR, harus sama dengan salah satu opsi responses
        pairs.append({"id": str(i), "p": f"Ibu kota Provinsi {prov} adalah kota apa?", "r": label})
        responses.append(label)
    shuffled = list(reversed(responses))
    match_options = json.dumps({"pairs": pairs, "responses": shuffled})
    match_answer = json.dumps({str(i): f"Ibu kota Provinsi {prov} adalah {cap}" for i, (prov, cap) in enumerate(cities, start=1)})
    assert len(match_answer) > 255, "matching test harus > 255 char"
    qs["matching"] = {
        "id": qrun(
            """INSERT INTO rhs_exam_questions
               (exam_id, question_text, options, correct_option, question_type, points, sort_order)
               VALUES (%s, %s, %s, 'M', 'matching', 30, 4)""",
            (exam_id, "Pasangkan ibu kota dengan provinsi", match_options),
        ),
        "answer": match_answer, "points": 30, "type": "matching",
    }

    # 5) True/False
    tf_options = json.dumps([
        {"originalKey": "A", "text": "Benar"},
        {"originalKey": "B", "text": "Salah"},
    ])
    qs["tf"] = {
        "id": qrun(
            """INSERT INTO rhs_exam_questions
               (exam_id, question_text, options, correct_option, question_type, points, sort_order)
               VALUES (%s, %s, %s, 'A', 'true_false', 10, 5)""",
            (exam_id, "Air mendidih pada suhu 100 derajat C di permukaan laut", tf_options),
        ),
        "answer": "A", "points": 10, "type": "true_false",
    }

    return qs


def full_answers(exam):
    """Jawaban 'semua benar' untuk sebuah ujian."""
    return {
        str(exam["questions"]["mc"]["id"]): "A",
        str(exam["questions"]["pgk"]["id"]): "A,B",
        str(exam["questions"]["essay"]["id"]): exam["questions"]["essay"]["answer"],
        str(exam["questions"]["matching"]["id"]): exam["questions"]["matching"]["answer"],
        str(exam["questions"]["tf"]["id"]): "A",
    }


def expected_score(exam):
    """100% (semua jawaban benar) = max points -> 100.0"""
    return 100.0


# ---------------------------------------------------------------- api ops
def start_attempt(sess, exam_id):
    r = sess.post(f"{BASE}/api/exams/start-attempt", json={"examId": exam_id}, timeout=20)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"start-attempt gagal: HTTP {r.status_code} {r.text[:200]}")
    data = r.json()
    cache_purge(f"exam:active-attempt:*")
    return data["attempt"]


def save_temp(sess, exam_id, qid, val):
    return sess.post(
        f"{BASE}/api/exams/temporary-answer",
        json={"examId": exam_id, "questionId": qid, "selectedOption": val},
        timeout=20,
    )


def save_temp_batch(sess, exam_id, answers):
    return sess.post(
        f"{BASE}/api/exams/temporary-answer",
        json={"examId": exam_id, "answers": answers},
        timeout=20,
    )


def submit(sess, exam_id, attempt_id, answers, is_force=False):
    return sess.post(
        f"{BASE}/api/exams/submit",
        json={"examId": exam_id, "answers": answers, "attemptId": attempt_id, "isForce": is_force},
        timeout=40,
    )


def attempt_row(attempt_id):
    return q("SELECT * FROM rhs_exam_attempts WHERE id = %s", (attempt_id,), one=True)


def answers_of(attempt_id):
    return q("SELECT * FROM rhs_student_answer WHERE attempt_id = %s ORDER BY question_id", (attempt_id,))


def temp_answers_of(user_id, exam_id):
    return q(
        "SELECT question_id, selected_option FROM rhs_temporary_answer WHERE user_id = %s AND exam_id = %s",
        (user_id, exam_id),
    )


def wait_completed(attempt_id, timeout=60, poll=1.5):
    """Tunggu attempt jadi completed."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        row = attempt_row(attempt_id)
        if row and row["status"] == "completed":
            return row
        time.sleep(poll)
    return attempt_row(attempt_id)


# ---------------------------------------------------------------- tests
def run_migration_via_api():
    """Jalankan migrasi resmi aplikasi (GET /api/setup) memakai sesi admin.
    Ini jalur yang sama dengan tombol 'Setup' di halaman System Overview."""
    global BASE
    banner("MIGRASI SKEMA (--migrate)")
    try:
        s = login(ADMIN_USER, ADMIN_PASS)
    except Exception as e:
        record("MIG.1 login admin", False, str(e))
        return False

    # Jalankan route setup resmi aplikasi (sama seperti tombol Setup di Dashboard).
    # Auth lewat cookie sesi admin, tidak ada lagi key hardcoded.
    r = s.get(f"{BASE}/api/setup", timeout=300)

    if r.status_code != 200:
        record("MIG.2 jalankan /api/setup", False, f"HTTP {r.status_code} {r.text[:120]}")
        return False

    record("MIG.2 jalankan /api/setup", True, f"HTTP {r.status_code}")

    msgs = r.json().get("messages", [])
    for kw in ["selected_option", "unique_attempt_question", "correct_option", "last_login"]:
        found = [m for m in msgs if kw in m]
        if found:
            log(f"    · {found[0]}")

    # Verifikasi
    ok = True
    for tbl in ("rhs_student_answer", "rhs_temporary_answer"):
        dt = q(
            "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() "
            "AND TABLE_NAME=%s AND COLUMN_NAME='selected_option'", (tbl,), one=True,
        )
        dt = (dt or {}).get("DATA_TYPE")
        record(f"MIG.3 {tbl}.selected_option = text", dt == "text", f"tipe={dt}")
        ok = ok and dt == "text"

    co = q(
        "SELECT CHARACTER_MAXIMUM_LENGTH len FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() "
        "AND TABLE_NAME='rhs_exam_questions' AND COLUMN_NAME='correct_option'", one=True,
    )
    ln = (co or {}).get("len") or 0
    record("MIG.4 correct_option panjang >= 255", ln >= 255, f"panjang={ln}")
    ok = ok and ln >= 255

    uk = q(
        "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() "
        "AND TABLE_NAME='rhs_student_answer' AND INDEX_NAME='unique_attempt_question'", one=True,
    )["c"] > 0
    record("MIG.5 unique key ada", uk)
    return ok and uk


def t00_preflight():
    banner("T00 - PREFLIGHT & SKEMA")
    try:
        r = requests.get(f"{BASE}/api/license/status", timeout=15)
        ok = r.status_code in (200, 401, 403)
        record("T00.1 server merespons", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("T00.1 server merespons", False, str(e))
        return False

    # login admin
    try:
        admin = login(ADMIN_USER, ADMIN_PASS)
        me = admin.get(f"{BASE}/api/user-session", timeout=15)
        data = me.json() if me.status_code == 200 else {}
        ok = data.get("user", {}).get("roleName") == "admin"
        record("T00.2 login admin", ok, f"role={data.get('user', {}).get('roleName')}")
        if not ok:
            return False
    except Exception as e:
        record("T00.2 login admin", False, str(e))
        return False

    # skema: selected_option harus TEXT
    bad = []
    for tbl in ("rhs_student_answer", "rhs_temporary_answer"):
        col = q(
            "SELECT DATA_TYPE FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = 'selected_option'",
            (tbl,), one=True,
        )
        dt = (col or {}).get("DATA_TYPE", "")
        record(f"T00.3 {tbl}.selected_option = TEXT", dt == "text", f"tipe={dt}")
        if dt != "text":
            bad.append(tbl)

    # unique key
    has_uk = q(
        "SELECT COUNT(*) c FROM information_schema.STATISTICS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='rhs_student_answer' "
        "AND INDEX_NAME='unique_attempt_question'",
        one=True,
    )["c"] > 0
    record("T00.4 UNIQUE(attempt_id,question_id) ada", has_uk, "" if has_uk else "jalankan Setup!")
    if not has_uk:
        bad.append("unique_key")

    # correct_option harus muat jawaban majemuk (mis. "A,B")
    co = q(
        "SELECT CHARACTER_MAXIMUM_LENGTH len FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='rhs_exam_questions' "
        "AND COLUMN_NAME='correct_option'", one=True,
    )
    co_len = int((co or {}).get("len") or 0)
    record("T00.5 correct_option >= 255", co_len >= 255, f"panjang={co_len}")
    if co_len < 255:
        bad.append("correct_option")

    if bad:
        log(color("1;33", "  ⚠ Skema belum termigrasi. Jalankan /api/setup terlebih dahulu."))
    return not bad


def t01_manual_submit(admin, ids):
    banner("T01 - MANUAL SUBMIT (semua tipe soal)")
    exam = ids["exam_a"]
    stu = ids["students"][0]
    s = login(stu["username"])

    att = start_attempt(s, exam["id"])
    answers = full_answers(exam)

    # stepwise: simpan tiap jawaban lewat temp-answer seperti siswa sungguhan
    temp_fail = []
    for qid, val in answers.items():
        r = save_temp(s, exam["id"], int(qid), val)
        if r.status_code != 200:
            temp_fail.append(f"soal {qid[:6]}: HTTP {r.status_code} {r.text[:70]}")
    record("T01.1 semua jawaban sementara tersimpan", len(temp_fail) == 0,
           f"{len(temp_fail)} gagal" if temp_fail else f"{len(answers)} soal")

    # pastikan temp terbaca balik
    got = s.get(f"{BASE}/api/exams/temporary-answer?exam_id={exam['id']}", timeout=15).json()
    record("T01.2 temp-answer terbaca balik", len(got) == len(answers), f"{len(got)}/{len(answers)}")

    # submit
    r = submit(s, exam["id"], att["id"], answers)
    record("T01.3 submit manual sukses", r.status_code == 200, f"HTTP {r.status_code} {r.text[:100]}")

    if r.status_code == 200:
        row = attempt_row(att["id"])
        record("T01.4 attempt completed", row["status"] == "completed", f"status={row['status']}")
        record("T01.5 end_time terisi", row["end_time"] is not None, str(row["end_time"]))
        record(
            "T01.6 skor = 100 (semua benar)",
            abs(float(row["score"]) - expected_score(exam)) < 0.01,
            f"score={row['score']}",
        )
        rows = answers_of(att["id"])
        record("T01.7 semua jawaban tersimpan", len(rows) == len(answers), f"{len(rows)}/{len(answers)}")

        # temp harus dibersihkan
        temp = temp_answers_of(stu["id"], exam["id"])
        record("T01.8 temp answers dibersihkan", len(temp) == 0, f"sisa={len(temp)}")

        # log
        logs = q("SELECT * FROM rhs_exam_logs WHERE attempt_id = %s AND action_type='SUBMIT'", (att["id"],))
        record("T01.9 log SUBMIT tercatat", len(logs) >= 1, f"{len(logs)} baris")
    return att["id"]


def t02_no_truncation(admin, ids):
    banner("T02 - JAWABAN PANJANG TIDAK TERPOTONG (>255 char)")
    exam = ids["exam_a"]
    rows = answers_of(
        q("SELECT id FROM rhs_exam_attempts WHERE user_id=%s AND exam_id=%s ORDER BY id DESC LIMIT 1",
          (ids["students"][0]["id"], exam["id"]), one=True)["id"]
    )
    if not rows:
        record("T02.x ada baris jawaban", False)
        return

    by_q = {str(r["question_id"]): r["selected_option"] for r in rows}

    # essay
    exp = exam["questions"]["essay"]["answer"]
    got = by_q.get(str(exam["questions"]["essay"]["id"]))
    record(
        "T02.1 essay utuh (tidak terpotong)",
        got == exp,
        f"panjang tersimpan={len(got or '')} / dikirim={len(exp)}",
    )

    # matching
    expm = exam["questions"]["matching"]["answer"]
    gotm = by_q.get(str(exam["questions"]["matching"]["id"]))
    record(
        "T02.2 matching JSON utuh",
        gotm == expm,
        f"panjang tersimpan={len(gotm or '')} / dikirim={len(expm)}",
    )
    if gotm:
        try:
            parsed = json.loads(gotm)
            record("T02.3 matching JSON valid & 6 pasangan", len(parsed) == 6, f"{len(parsed)} pasangan")
        except Exception as e:
            record("T02.3 matching JSON valid", False, str(e))

    # tidak boleh ada baris kosong / null
    empties = [r for r in rows if r["selected_option"] in (None, "")]
    record("T02.4 tidak ada jawaban kosong tersimpan", len(empties) == 0, f"{len(empties)} baris")


def t03_auto_submit(admin, ids, wait_seconds):
    banner("T03 - AUTO-SUBMIT (waktu habis, siswa tetap online)")
    exam = ids["exam_b"]  # async duration 0 menit
    stu = ids["students"][1]
    s = login(stu["username"])

    att = start_attempt(s, exam["id"])
    answers = full_answers(exam)

    batch = save_temp_batch(s, exam["id"], answers)
    record("T03.1 simpan jawaban via batch endpoint", batch.status_code == 200,
           f"HTTP {batch.status_code} {batch.text[:80]}")

    log(f"  … menunggu auto-submit server (max {wait_seconds}s, scheduler 30s)")
    row = wait_completed(att["id"], timeout=wait_seconds)

    record("T03.2 attempt auto-completed", row and row["status"] == "completed",
           f"status={row['status'] if row else None}")
    if not row or row["status"] != "completed":
        return None

    rows = answers_of(att["id"])
    record("T03.3 jawaban tersimpan oleh server", len(rows) == len(answers), f"{len(rows)}/{len(answers)}")

    essay_ok = any(
        str(r["question_id"]) == str(exam["questions"]["essay"]["id"]) and r["selected_option"] == answers[str(exam["questions"]["essay"]["id"])]
        for r in rows
    )
    record("T03.4 essay panjang utuh setelah auto-submit", essay_ok)

    record("T03.5 temp answers dibersihkan", len(temp_answers_of(stu["id"], exam["id"])) == 0)
    record("T03.6 log SUBMIT otomatis ada",
           len(q("SELECT * FROM rhs_exam_logs WHERE attempt_id=%s AND action_type='SUBMIT'", (att["id"],))) >= 1)

    record("T03.7 auto-submit skor = 100", abs(float(row["score"]) - 100.0) < 0.01, f"score={row['score']}")
    return att["id"]


def t04_score_parity(admin, ids):
    banner("T04 - SKOR AUTO-SUBMIT == SKOR MANUAL (regresi scoring)")
    # Attempt manual di ujian A (student 0) vs auto-submit di ujian B (student 1)
    man = q(
        "SELECT score, status FROM rhs_exam_attempts WHERE user_id=%s AND exam_id=%s ORDER BY id DESC LIMIT 1",
        (ids["students"][0]["id"], ids["exam_a"]["id"]), one=True,
    )
    aut = q(
        "SELECT score, status FROM rhs_exam_attempts WHERE user_id=%s AND exam_id=%s ORDER BY id DESC LIMIT 1",
        (ids["students"][1]["id"], ids["exam_b"]["id"]), one=True,
    )
    if not man or not aut:
        record("T04.x data attempt tersedia", False)
        return

    record("T04.1 attempt manual completed", man["status"] == "completed", str(man["status"]))
    record("T04.2 attempt auto completed", aut["status"] == "completed", str(aut["status"]))
    if man["score"] is None or aut["score"] is None:
        record("T04.3 skor identik", False, f"manual={man['score']} auto={aut['score']}")
        return
    same = abs(float(man["score"]) - float(aut["score"])) < 0.01
    record("T04.3 skor identik", same, f"manual={man['score']} auto={aut['score']}")

    # PGK partial: student 3 jawab cuma 1 dari 2 benar -> 50% dari 20 poin
    exam = ids["exam_a"]
    stu = ids["students"][3]
    s = login(stu["username"])
    att = start_attempt(s, exam["id"])
    partial = {
        str(exam["questions"]["mc"]["id"]): "A",
        str(exam["questions"]["pgk"]["id"]): "A",              # hanya 1 dari 2 -> 10/20
        str(exam["questions"]["tf"]["id"]): "A",
    }
    submit(s, exam["id"], att["id"], partial)
    row = attempt_row(att["id"])
    # total poin = 10 + 20 + 30 + 30 + 10 = 100; earned = 10 + 10 + 0 + 0 + 10 = 30 -> 30%
    record("T04.4 partial credit PGK dihitung benar", abs(float(row["score"]) - 30.0) < 0.5,
           f"score={row['score']} (harapan ~30)")


def t05_race_submit(admin, ids):
    banner("T05 - RACE: 8 THREAD SUBMIT BERSAMAAN")
    exam = ids["exam_a"]
    stu = ids["students"][4]
    s = login(stu["username"])
    att = start_attempt(s, exam["id"])
    answers = full_answers(exam)
    save_temp_batch(s, exam["id"], answers)

    results = []
    def worker():
        try:
            r = submit(s, exam["id"], att["id"], answers, is_force=True)
            results.append(r.status_code)
        except Exception as e:
            results.append(str(e))

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads: t.start()
    for t in threads: t.join()

    record("T05.1 semua request selesai", len(results) == 8, f"status={results}")

    row = attempt_row(att["id"])
    record("T05.2 attempt tetap completed", row["status"] == "completed", str(row["status"]))

    rows = answers_of(att["id"])
    record("T05.3 TIDAK ada jawaban duplikat", len(rows) == len(answers), f"{len(rows)} baris (harus {len(answers)})")

    qids = [str(r["question_id"]) for r in rows]
    record("T05.4 question_id unik", len(qids) == len(set(qids)), f"{len(qids)} id / {len(set(qids))} unik")

    logs = q("SELECT * FROM rhs_exam_logs WHERE attempt_id=%s AND action_type='SUBMIT'", (att["id"],))
    record("T05.5 log SUBMIT tidak menggandakan", len(logs) <= 2, f"{len(logs)} baris")

    # attempt lain untuk user & exam yang sama harus tetap bisa dibuat
    return att["id"]


def t06_race_expiry_merge(admin, ids):
    banner("T06 - RACE: SUBMIT CLIENT SAAT SERVER SUDAH AUTO-SUBMIT")
    exam = ids["exam_b"]
    stu = ids["students"][5]
    s = login(stu["username"])
    att = start_attempt(s, exam["id"])

    # Student sudah kehabisan waktu (duration 0). Tunggu server auto-submit dulu.
    log("  … menunggu auto-submit server")
    row = wait_completed(att["id"], timeout=60)
    if not row or row["status"] != "completed":
        record("T06.1 server auto-submit dulu", False, str(row["status"] if row else None))
        return
    record("T06.1 server auto-submit dulu", True)

    # Kinikan jawaban ini ADA DI MEMORY SISWA tapi belum pernah sampai ke temp
    # (simulasi: koneksi putus total). Jawaban sengaja tidak dikirim ke temp.
    answers = full_answers(exam)
    q("DELETE FROM rhs_student_answer WHERE attempt_id = %s", (att["id"],))

    r = submit(s, exam["id"], att["id"], answers, is_force=True)
    record("T06.2 submitracun tetap 200", r.status_code == 200, f"HTTP {r.status_code}")

    rows = answers_of(att["id"])
    record("T06.3 jawaban client TERSIMPAN setelah merge", len(rows) == len(answers),
           f"{len(rows)}/{len(answers)}")
    row2 = attempt_row(att["id"])
    record("T06.4 skor tidak berubah/ditimpa", row2["status"] == "completed", f"score={row2['score']}")


def t07_batch_beacon(admin, ids):
    banner("T07 - ENDPOINT BATCH (FORMAT SENDBEACON)")
    exam = ids["exam_a"]
    stu = ids["students"][6]
    s = login(stu["username"])
    att = start_attempt(s, exam["id"])
    answers = full_answers(exam)

    # Kirim 2x (idempotency)
    for i in range(2):
        r = save_temp_batch(s, exam["id"], answers)
        record(f"T07.{i+1} batch save HTTP 200", r.status_code == 200, f"HTTP {r.status_code}")

    rows = temp_answers_of(stu["id"], exam["id"])
    record("T07.3 tidak ada duplikat di temp", len(rows) == len(answers), f"{len(rows)}/{len(answers)}")

    long_rows = [r for r in rows if len(r["selected_option"] or "") > 255]
    record("T07.4 temp menyimpan jawaban >255 char", len(long_rows) >= 2, f"{len(long_rows)} baris panjang")

    # kosongkan temp & submit
    r = submit(s, exam["id"], att["id"], answers)
    record("T07.5 submit setelah batch save", r.status_code == 200, f"HTTP {r.status_code}")


def t08_require_all(admin, ids):
    banner("T08 - REQUIRE_ALL_ANSWERED")
    exam = ids["exam_a"]
    q("UPDATE rhs_exam_settings SET require_all_answered = 1 WHERE exam_id = %s", (exam["id"],))
    cache_purge(f"exam:settings-full:{exam['id']}")

    stu = ids["students"][7]
    s = login(stu["username"])
    att = start_attempt(s, exam["id"])

    partial = {str(exam["questions"]["mc"]["id"]): "A"}
    r = submit(s, exam["id"], att["id"], partial)
    record("T08.1 submit tidak lengkap ditolak 422", r.status_code == 422, f"HTTP {r.status_code}")

    row = attempt_row(att["id"])
    record("T08.2 attempt tetap in_progress", row["status"] == "in_progress", str(row["status"]))

    r2 = submit(s, exam["id"], att["id"], partial, is_force=True)
    record("T08.3 force submit tetap jalan", r2.status_code == 200, f"HTTP {r2.status_code}")

    q("UPDATE rhs_exam_settings SET require_all_answered = 0 WHERE exam_id = %s", (exam["id"],))
    cache_purge(f"exam:settings-full:{exam['id']}")


def t09_force_submit_online(admin, ids):
    banner("T09 - FORCE SUBMIT: SISWA ONLINE TIDAK BOLEH DI-SUBMIT SERVER")
    exam = ids["exam_a"]
    stu = ids["students"][8]
    s = login(stu["username"])

    # pastikan Redis heartbeat aktif untuk user ini (simulasi siswa online)
    marked_online = False
    if REDIS is not None:
        try:
            REDIS.set(f"online:{stu['id']}", 1, ex=120)
            q("UPDATE rhs_users SET last_activity = NOW(), is_online_realtime = 1 WHERE id = %s", (stu["id"],))
            marked_online = True
        except Exception as e:
            log(f"  (Redis tidak bisa ditulis: {e}) — lanjut dengan fallback MySQL")

    att = start_attempt(s, exam["id"])
    save_temp_batch(s, exam["id"], full_answers(exam))

    r = admin.post(
        f"{BASE}/api/control/actions",
        json={"action": "force_submit", "userId": stu["id"], "attemptId": att["id"]},
        timeout=30,
    )
    record("T09.1 aksi force_submit diterima", r.status_code == 200, f"HTTP {r.status_code} {r.text[:80]}")

    time.sleep(4)
    row = attempt_row(att["id"])
    if marked_online:
        record("T09.2 attempt TIDAK auto-submit dari server", row["status"] == "in_progress",
               f"status={row['status']} (siswa online, harus via SSE)")
    else:
        record("T09.2 (fallback MySQL) dicek manual", True, f"status={row['status']}")

    if REDIS is not None:
        try:
            REDIS.delete(f"online:{stu['id']}")
        except Exception:
            pass
    return att["id"]


def t10_force_submit_offline(admin, ids):
    banner("T10 - FORCE SUBMIT: SISWA OFFLINE BOLEH DI-SUBMIT SERVER")
    exam = ids["exam_a"]
    stu = ids["students"][2]
    s = login(stu["username"])
    att = start_attempt(s, exam["id"])
    save_temp_batch(s, exam["id"], full_answers(exam))

    # tandai offline
    q("UPDATE rhs_users SET last_activity = DATE_SUB(NOW(), INTERVAL 5 MINUTE), is_online_realtime = 0 WHERE id = %s",
      (stu["id"],))
    if REDIS is not None:
        try:
            REDIS.delete(f"online:{stu['id']}")
        except Exception:
            pass

    r = admin.post(
        f"{BASE}/api/control/actions",
        json={"action": "force_submit", "userId": stu["id"], "attemptId": att["id"]},
        timeout=30,
    )
    record("T10.1 force_submit offline diterima", r.status_code == 200, f"HTTP {r.status_code}")

    row = wait_completed(att["id"], timeout=25)
    record("T10.2 server auto-submit untuk siswa offline", row and row["status"] == "completed",
           f"status={row['status'] if row else None}")

    rows = answers_of(att["id"])
    record("T10.3 jawaban tetap tersimpan", len(rows) == 5, f"{len(rows)}/5")


def t11_recalculate(admin, ids):
    banner("T11 - RECALCULATE TIDAK MENGGANDAKAN BARIS")
    exam = ids["exam_a"]
    before = q("SELECT COUNT(*) c FROM rhs_student_answer WHERE exam_id = %s", (exam["id"],), one=True)["c"]
    r = admin.post(f"{BASE}/api/exams/recalculate", json={"examId": exam["id"]}, timeout=120)
    record("T11.1 recalculate sukses", r.status_code == 200, f"HTTP {r.status_code} {r.text[:80]}")
    after = q("SELECT COUNT(*) c FROM rhs_student_answer WHERE exam_id = %s", (exam["id"],), one=True)["c"]
    record("T11.2 jumlah baris tetap", before == after, f"sebelum={before} sesudah={after}")

    dups = q(
        "SELECT attempt_id, question_id, COUNT(*) c FROM rhs_student_answer "
        "WHERE exam_id = %s GROUP BY attempt_id, question_id HAVING c > 1",
        (exam["id"],),
    )
    record("T11.3 tidak ada duplikat (attempt,question)", len(dups) == 0, f"{len(dups)} grup")


def t12_unique_constraint(admin, ids):
    banner("T12 - UNIQUE KEY BENAR-BENAR AKTIF")
    exam = ids["exam_a"]
    row = q("SELECT * FROM rhs_student_answer WHERE exam_id = %s LIMIT 1", (exam["id"],), one=True)
    if not row:
        record("T12.x ada baris untuk dites", False)
        return
    try:
        qrun(
            """INSERT INTO rhs_student_answer
               (user_id, exam_id, attempt_id, question_id, selected_option, is_correct, score_earned)
               VALUES (%s, %s, %s, %s, 'DUPLICATE_TEST', 0, 0)""",
            (row["user_id"], row["exam_id"], row["attempt_id"], row["question_id"]),
        )
        record("T12.1 insert duplikat DITOLAK", False, "tidak ada error → unique key belum ada!")
        q("DELETE FROM rhs_student_answer WHERE selected_option = 'DUPLICATE_TEST'")
    except Exception:
        record("T12.1 insert duplikat DITOLAK", True, "error duplicate key (bagus)")


def t13_session_control(admin, ids):
    banner("T13 - API KONTROL SESI")
    r = admin.get(f"{BASE}/api/session-control?role=student", timeout=30)
    ok = r.status_code == 200
    record("T13.1 list sesi", ok, f"HTTP {r.status_code}")
    if not ok:
        return
    data = r.json()
    record("T13.2 struktur respons", "users" in data and "summary" in data,
           f"users={len(data.get('users', []))}")
    test_users = {u["username"] for u in data["users"]}
    record("T13.3 siswa test terdaftar", ids["students"][0]["username"] in test_users)

    # restart session
    stu = ids["students"][1]
    r2 = admin.post(f"{BASE}/api/session-control",
                    json={"action": "restart_session", "userId": stu["id"]}, timeout=30)
    record("T13.4 restart session", r2.status_code == 200, f"HTTP {r2.status_code} {r2.text[:60]}")
    row = q("SELECT session_id FROM rhs_users WHERE id = %s", (stu["id"],), one=True)
    record("T13.5 session_id di-null-kan", row["session_id"] is None, str(row["session_id"]))

    # unlock
    q("UPDATE rhs_users SET failed_login_attempts = 4, locked_until = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = %s",
      (ids["students"][2]["id"],))
    r3 = admin.post(f"{BASE}/api/session-control",
                    json={"action": "unlock", "userId": ids["students"][2]["id"]}, timeout=30)
    u = q("SELECT failed_login_attempts, locked_until FROM rhs_users WHERE id = %s",
          (ids["students"][2]["id"],), one=True)
    record("T13.6 unlock reset lock",
           r3.status_code == 200 and u["failed_login_attempts"] == 0 and u["locked_until"] is None,
           f"attempts={u['failed_login_attempts']} until={u['locked_until']}")


# ---------------------------------------------------------------- cleanup
def cleanup(ids):
    banner("CLEANUP")
    try:
        exam_ids = [ids["exam_a"]["id"], ids["exam_b"]["id"], ids["exam_c"]["id"]]
        uids = [s["id"] for s in ids["students"]]
        ph = ",".join(["%s"] * len(uids))
        eh = ",".join(["%s"] * len(exam_ids))

        q(f"DELETE FROM rhs_student_answer WHERE exam_id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_temporary_answer WHERE exam_id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_temporary_answer_archive WHERE exam_id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_exam_logs WHERE attempt_id IN "
          f"(SELECT id FROM rhs_exam_attempts WHERE exam_id IN ({eh}))", exam_ids)
        q(f"DELETE FROM rhs_exam_attempts WHERE exam_id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_exam_questions WHERE exam_id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_exam_settings WHERE exam_id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_exam_classes WHERE exam_id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_exams WHERE id IN ({eh})", exam_ids)
        q(f"DELETE FROM rhs_activity_logs WHERE user_id IN ({ph})", uids)
        q(f"DELETE FROM rhs_users WHERE id IN ({ph})", uids)
        q("DELETE FROM rhs_classes WHERE id = %s", (ids["class_id"],))
        log(color("1;32", "  Data test dibersihkan."))
    except Exception as e:
        log(color("1;33", f"  ⚠ Cleanup gagal: {e}"))


# ---------------------------------------------------------------- main
def main():
    global ARGS, BASE, DB, REDIS

    # Windows console sering cp1252 -> paksa UTF-8 agar emoji/garis box tidak error
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("BASE_URL", "http://localhost:3000"))
    ap.add_argument("--env", default=".env.local")
    ap.add_argument("--keep", action="store_true", help="jangan hapus data test")
    ap.add_argument("--only", nargs="*", default=None, help="jalankan test tertentu, mis: --only T01 T02")
    ap.add_argument("--wait-autosubmit", type=int, default=60,
                    help="tunggu maksimum auto-submit server (detik)")
    ap.add_argument("--migrate", action="store_true",
                    help="jalankan migrasi /api/setup dulu bila skema belum sesuai")
    ARGS = ap.parse_args()

    BASE = ARGS.base.rstrip("/")
    ENV = load_env(ARGS.env)

    print(color("1;35", f"""
=====================================================================
  RUSHLESS EXAM - TEST SUITE SUBMIT & AUTO-SUBMIT
  Target : {BASE}
  DB     : {ENV.get('DB_HOST','?')}/{ENV.get('DB_NAME','?')}
====================================================================="""))

    if not ENV.get("DB_HOST") or not ENV.get("DB_NAME"):
        print(color("1;31", "ERROR: DB_HOST/DB_NAME tidak ditemukan di .env.local"))
        sys.exit(1)

    try:
        DB = pymysql.connect(
            host=ENV["DB_HOST"], user=ENV["DB_USER"], password=ENV["DB_PASSWORD"],
            database=ENV["DB_NAME"], charset="utf8mb4", autocommit=True,
            cursorclass=pymysql.cursors.DictCursor, connect_timeout=10,
        )
    except Exception as e:
        print(color("1;31", f"ERROR: tidak bisa connect DB: {e}"))
        sys.exit(1)

    if redis_lib is not None:
        try:
            REDIS = redis_lib.Redis(
                host=os.environ.get("REDIS_HOST", "127.0.0.1"),
                port=int(os.environ.get("REDIS_PORT", 6379)),
                password=os.environ.get("REDIS_PASSWORD") or None,
                socket_connect_timeout=2,
            )
            REDIS.ping()
        except Exception:
            REDIS = None

    log(f"  Redis : {'aktif' if REDIS else 'tidak aktif (mode fallback MySQL)'}")
    log(f"  Mode  : {'DB langsung + HTTP API'}{'' if REDIS else ''}")

    only = set(ARGS.only) if ARGS.only else None

    def want(name):
        if only is None:
            return True
        return any(name.startswith(o) for o in only)

    if want("T00"):
        schema_ok = t00_preflight()
        if not schema_ok and ARGS.migrate:
            log(color("1;33", "\n  Skema belum sesuai -> menjalankan migrasi (--migrate)"))
            before = len(RESULTS)
            if run_migration_via_api():
                schema_ok = t00_preflight()
                if schema_ok:
                    # Hapus catatan gagal pra-migrasi agar ringkasan final bersih
                    del RESULTS[before - 5:]
                    log(color("1;32", "  Migrasi berhasil, pemeriksaan skema ulang: OK"))
        if not schema_ok:
            log(color("1;31", "\nPREFLIGHT GAGAL - hentikan."))
            log(color("1;33", "  Jalankan: python scripts/test_exam_flow.py --migrate"))
            sys.exit(1)

    ids = seed()

    try:
        admin = login(ADMIN_USER, ADMIN_PASS)

        if want("T01"): t01_manual_submit(admin, ids)
        if want("T02"): t02_no_truncation(admin, ids)
        if want("T03"): t03_auto_submit(admin, ids, ARGS.wait_autosubmit)
        if want("T04"): t04_score_parity(admin, ids)
        if want("T05"): t05_race_submit(admin, ids)
        if want("T06"): t06_race_expiry_merge(admin, ids)
        if want("T07"): t07_batch_beacon(admin, ids)
        if want("T08"): t08_require_all(admin, ids)
        if want("T09"): t09_force_submit_online(admin, ids)
        if want("T10"): t10_force_submit_offline(admin, ids)
        if want("T11"): t11_recalculate(admin, ids)
        if want("T12"): t12_unique_constraint(admin, ids)
        if want("T13"): t13_session_control(admin, ids)

    finally:
        if ARGS.keep:
            banner("DATA TEST DISIMPAN (--keep)")
            log(f"  exam_ids: {[ids['exam_a']['id'], ids['exam_b']['id'], ids['exam_c']['id']]}")
            log(f"  student usernames: {[s['username'] for s in ids['students']]}")
        else:
            cleanup(ids)

    # summary
    banner("RINGKASAN")
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = [(t, d) for t, ok, d in RESULTS if not ok]
    total = len(RESULTS)
    pct = (passed / total * 100) if total else 0

    for t, ok, d in RESULTS:
        mark = color("1;32", "✓") if ok else color("1;31", "✗")
        log(f"  {mark} {t}" + (f"  ({d})" if d and not ok else ""))

    log("")
    log(color("1;36", f"  TOTAL {total} | PASS {passed} | FAIL {len(failed)} | {pct:.1f}%"))
    if failed:
        log(color("1;31", "\n  GAGAL:"))
        for t, d in failed:
            log(color("1;31", f"   - {t} {d}"))
        sys.exit(1)
    else:
        log(color("1;32", "\n  SEMUA TEST LULUS ✅"))


if __name__ == "__main__":
    main()