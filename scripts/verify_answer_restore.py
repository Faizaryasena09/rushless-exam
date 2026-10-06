"""Verifikasi fitur pemulihan jawaban (restore + undo)."""
import json
import uuid

import pymysql
import requests

env = {}
for line in open('.env.local'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"')

BASE = 'http://localhost:3000'
PW = "$2b$10$Bip8Jha67dJS2knb5Hd6T.DZI97ugPxUtGwC7qgMpbTFtd4OmHk0e"
OK = 0
FAIL = 0


def check(name, cond, detail=''):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
    print(('  [PASS] ' if cond else '  [FAIL] ') + name + (f' - {detail}' if detail else ''))


def db():
    return pymysql.connect(host=env['DB_HOST'], user=env['DB_USER'], password=env['DB_PASSWORD'],
                           database=env['DB_NAME'], cursorclass=pymysql.cursors.DictCursor, autocommit=True)


def admin():
    s = requests.Session()
    r = s.post(f'{BASE}/api/login', json={'username': 'admin', 'password': 'admin'}, timeout=20)
    if r.status_code == 409:
        c = db(); cur = c.cursor()
        cur.execute("UPDATE rhs_users SET session_id=NULL, last_activity='1970-01-01 00:00:00' WHERE username='admin'")
        cur.close(); c.close()
        s = requests.Session()
        r = s.post(f'{BASE}/api/login', json={'username': 'admin', 'password': 'admin'}, timeout=20)
    assert r.status_code == 200, r.text
    return s


st = uuid.uuid4().hex[:6]
c = db(); cur = c.cursor()

cur.execute('INSERT INTO rhs_classes (class_name) VALUES (%s)', (f'ZZTEST_K_{st}',)); cid = cur.lastrowid
cur.execute('INSERT INTO rhs_users (username, password, role, class_id) VALUES (%s,%s,%s,%s)', (f'zztest_{st}', PW, 'student', cid)); uid = cur.lastrowid
cur.execute('INSERT INTO rhs_exams (exam_name, timer_mode, duration_minutes, max_attempts) VALUES (%s,%s,60,5)', (f'ZZTEST_E_{st}', 'async')); eid = cur.lastrowid
cur.execute('INSERT INTO rhs_exam_settings (exam_id, start_time, end_time, show_result) VALUES (%s, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1)', (eid,))
cur.execute('INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES (%s,%s)', (eid, cid))
opts = json.dumps([{"originalKey": "A", "text": "X"}, {"originalKey": "B", "text": "Y"}])
cur.execute('INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option, question_type, points, sort_order) VALUES (%s,%s,%s,%s,%s,50,1)', (eid, 'Soal 1', opts, 'A', 'multiple_choice')); q1 = cur.lastrowid
cur.execute('INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option, question_type, points, sort_order) VALUES (%s,%s,%s,%s,%s,50,2)', (eid, 'Soal 2', opts, 'A', 'multiple_choice')); q2 = cur.lastrowid
cur.execute('INSERT INTO rhs_exam_attempts (user_id, exam_id, start_time, status, score) VALUES (%s,%s,NOW(),%s,0)', (uid, eid, 'completed')); aid = cur.lastrowid

# ARSIP: q1='A' (benar), q2='B' (salah)
cur.execute('INSERT INTO rhs_temporary_answer_archive (attempt_id,user_id,exam_id,question_id,selected_option,answer_source,username,student_name,exam_name,class_name,created_at,archived_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
            (aid, uid, eid, q1, 'A', 'submit', f'zztest_{st}', 'Siswa Uji', 'Ujian Uji', 'Kelas Uji'))
cur.execute('INSERT INTO rhs_temporary_answer_archive (attempt_id,user_id,exam_id,question_id,selected_option,answer_source,username,student_name,exam_name,class_name,created_at,archived_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
            (aid, uid, eid, q2, 'B', 'submit', f'zztest_{st}', 'Siswa Uji', 'Ujian Uji', 'Kelas Uji'))

# TABEL JAWABAN SAAT INI: hanya q1='B' (salah) -> q2 hilang (simulasi auto-submit tidak lengkap)
cur.execute('INSERT INTO rhs_student_answer (user_id, exam_id, attempt_id, question_id, selected_option, is_correct, score_earned) VALUES (%s,%s,%s,%s,%s,0,0)', (uid, eid, aid, q1, 'B'))

s = admin()

print('\n== PRATINJAU ==')
d = s.get(f'{BASE}/api/archive-answers?attempt_id={aid}&preview=1', timeout=30).json()
pv = d.get('preview') or {}
check('preview: 2 jawaban terarsip', pv.get('archivedCount') == 2, str(pv.get('archivedCount')))
check('preview: q2 terdeteksi hilang', pv.get('summary', {}).get('missing') == 1, str(pv.get('summary')))
check('preview: q1 terdeteksi berubah', pv.get('summary', {}).get('changed') == 1, str(pv.get('summary')))

print('\n== RESTORE MODE rescore ==')
r = s.post(f'{BASE}/api/archive-answers', json={'action': 'restore', 'attemptId': aid, 'mode': 'rescore'}, timeout=40).json()
check('restore sukses', 'restored' in r, r.get('message', ''))
check('2 jawaban dipulihkan', r.get('restored') == 2, str(r.get('restored')))
cur.execute('SELECT question_id, selected_option, is_correct, score_earned FROM rhs_student_answer WHERE attempt_id=%s ORDER BY question_id', (aid,))
rows = cur.fetchall()
check('q1 pulih jadi A & benar', any(x['question_id'] == q1 and x['selected_option'] == 'A' and x['is_correct'] == 1 for x in rows), str(rows))
check('q2 tersimpan dari arsip', any(x['question_id'] == q2 and x['selected_option'] == 'B' for x in rows), '')
check('total baris = 2 (tanpa duplikat)', len(rows) == 2, str(len(rows)))
cur.execute('SELECT status, score FROM rhs_exam_attempts WHERE id=%s', (aid,))
at = cur.fetchone()
check('attempt tetap completed', at['status'] == 'completed', at['status'])
check('skor = 50 (1 benar dari 2)', abs(float(at['score']) - 50.0) < 0.01, str(at['score']))
cur.execute('SELECT COUNT(*) n FROM rhs_answer_restore_backup WHERE attempt_id=%s AND question_id <> 0', (aid,))
check('backup jawaban lama tersimpan', cur.fetchone()['n'] == 1, '1 baris (+1 penanda grup)')

print('\n== UNDO ==')
r = s.post(f'{BASE}/api/archive-answers', json={'action': 'undo', 'attemptId': aid}, timeout=40).json()
check('undo sukses', r.get('undone') == 1, str(r.get('undone')))
cur.execute('SELECT question_id, selected_option FROM rhs_student_answer WHERE attempt_id=%s ORDER BY question_id', (aid,))
rows = cur.fetchall()
check('q1 kembali jadi B', any(x['question_id'] == q1 and x['selected_option'] == 'B' for x in rows), str(rows))
check('q2 (ditambah saat restore) dihapus', len(rows) == 1, f'{len(rows)} baris')
cur.execute('SELECT score FROM rhs_exam_attempts WHERE id=%s', (aid,))
sc = float(cur.fetchone()['score'])
check('skor kembali 0', abs(sc) < 0.01, str(sc))
cur.execute("SELECT is_undone FROM rhs_answer_restore_backup WHERE attempt_id=%s AND question_id = 0", (aid,))
check('backup ditandai undone', cur.fetchone()['is_undone'] == 1, '')

print('\n== RESTORE MODE reopen ==')
r = s.post(f'{BASE}/api/archive-answers', json={'action': 'restore', 'attemptId': aid, 'mode': 'reopen'}, timeout=40).json()
check('restore reopen sukses', r.get('restored') == 2, r.get('message', ''))
cur.execute('SELECT status FROM rhs_exam_attempts WHERE id=%s', (aid,))
check('attempt kembali in_progress', cur.fetchone()['status'] == 'in_progress', '')

print('\n== RECALCULATE ==')
r = s.post(f'{BASE}/api/archive-answers', json={'action': 'recalculate', 'attemptId': aid}, timeout=40).json()
check('recalculate sukses', 'score' in r, r.get('message', ''))
check('skor 50', abs(float(r.get('score', 0)) - 50.0) < 0.01, str(r.get('score')))

print('\n== RECOLETE: attempt SUDAH DIHAPUS ==')
# hapus attempt (seperti Reset Ujian), arsip harus tetap utuh
cur.execute('DELETE FROM rhs_student_answer WHERE attempt_id=%s', (aid,))
cur.execute('DELETE FROM rhs_answer_restore_backup WHERE attempt_id=%s', (aid,))
cur.execute('DELETE FROM rhs_exam_logs WHERE attempt_id=%s', (aid,))
cur.execute('DELETE FROM rhs_exam_attempts WHERE id=%s', (aid,))
cur.execute('SELECT COUNT(*) n FROM rhs_temporary_answer_archive WHERE attempt_id=%s', (aid,))
check('arsip tetap ada setelah attempt dihapus', cur.fetchone()['n'] == 2, '')

d = s.get(f'{BASE}/api/archive-answers?attempt_id={aid}&preview=1', timeout=30).json()
pv = d.get('preview') or {}
check('preview: attempt_exists = false', pv.get('attemptExists') is False, str(pv.get('attemptExists')))
check('preview: ujian masih ada', pv.get('examExists') is True, str(pv.get('examExists')))

r = s.post(f'{BASE}/api/archive-answers', json={'action': 'restore', 'attemptId': aid, 'mode': 'reopen'}, timeout=40).json()
check('recreate sukses', r.get('recreated') is True, r.get('message', ''))
new_aid = r.get('newAttemptId')
check('attempt baru dibuat', bool(new_aid) and new_aid != aid, f'{aid} -> {new_aid}')
cur.execute('SELECT COUNT(*) n, SUM(is_correct) c FROM rhs_student_answer WHERE attempt_id=%s', (new_aid,))
row = cur.fetchone()
check('jawaban tersimpan di attempt baru', row['n'] == 2, f"{row['n']} baris")
check('1 jawaban benar', int(row['c'] or 0) == 1, str(row['c']))
cur.execute('SELECT status FROM rhs_exam_attempts WHERE id=%s', (new_aid,))
check('attempt baru in_progress', cur.fetchone()['status'] == 'in_progress', '')

u = s.post(f'{BASE}/api/archive-answers', json={'action': 'undo', 'attemptId': new_aid}, timeout=40).json()
check('undo recreate: attempt dihapus lagi', u.get('removedAttempt') is True, str(u.get('message', '')))
cur.execute('SELECT COUNT(*) n FROM rhs_exam_attempts WHERE id=%s', (new_aid,))
check('attempt baru benar-benar hilang', cur.fetchone()['n'] == 0, '')

print('\n== EXPORT CSV ==')
r = s.get(f'{BASE}/api/archive-answers?export=csv&attempt_id={aid}', timeout=40)
check('export CSV 200', r.status_code == 200, f"HTTP {r.status_code}")
check('CSV berisi data siswa', 'zztest_' in r.text, r.text[:60].replace('\n', ' '))
check('CSV berisi jawaban', ('AAAA' in r.text) or ('B' in r.text), '')
check('CSV punya header', 'question_id' in r.text.split('\n')[0], r.text.split('\n')[0][:60])

# bersihkan
for sql, args in [
    ('DELETE FROM rhs_answer_restore_backup WHERE attempt_id=%s', (aid,)),
    ('DELETE FROM rhs_temporary_answer_archive WHERE attempt_id=%s', (aid,)),
    ('DELETE FROM rhs_exam_logs WHERE attempt_id=%s', (aid,)),
    ('DELETE FROM rhs_exam_attempts WHERE user_id=%s', (uid,)),
    ('DELETE FROM rhs_exam_questions WHERE exam_id=%s', (eid,)),
    ('DELETE FROM rhs_exam_settings WHERE exam_id=%s', (eid,)),
    ('DELETE FROM rhs_exam_classes WHERE exam_id=%s', (eid,)),
    ('DELETE FROM rhs_exams WHERE id=%s', (eid,)),
    ('DELETE FROM rhs_activity_logs WHERE user_id=%s', (uid,)),
    ('DELETE FROM rhs_users WHERE id=%s', (uid,)),
    ('DELETE FROM rhs_classes WHERE id=%s', (cid,)),
]:
    cur.execute(sql, args)

print(f'\nTOTAL: PASS {OK} | FAIL {FAIL}')
raise SystemExit(1 if FAIL else 0)