#!/usr/bin/env python3
"""
Uji end-to-end CLI rhsls.
Membuat data uji (kelas + user), menjalankan perintah, lalu membersihkan semuanya.
"""
import json
import subprocess
import sys
import os
import uuid

import pymysql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = {}
for line in open(os.path.join(ROOT, '.env.local'), encoding='utf-8'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        ENV[k.strip()] = v.strip().strip('"')

PW = "$2b$10$Bip8Jha67dJS2knb5Hd6T.DZI97ugPxUtGwC7qgMpbTFtd4OmHk0e"
CLI = os.path.join(ROOT, 'rhsls.cmd')
OK = 0
FAIL = 0


def db(name=None):
    return pymysql.connect(host=ENV['DB_HOST'], user=ENV['DB_USER'], password=ENV['DB_PASSWORD'],
                           database=name or ENV['DB_NAME'],
                           cursorclass=pymysql.cursors.DictCursor, autocommit=True)


def check(name, cond, detail=''):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
    print(('  [PASS] ' if cond else '  [FAIL] ') + name + (f' - {detail}' if detail else ''))


def run(*args, expect_ok=True):
    cmd = [CLI, *args]
    p = subprocess.run(cmd, capture_output=True, text=True, shell=False,
                       encoding='utf-8', errors='replace', cwd=ROOT, timeout=600)
    return p


def run_json(*args):
    p = run(*args, '--json')
    try:
        return json.loads(p.stdout)
    except Exception as e:
        print('    (JSON parse gagal)', p.stdout[:200], p.stderr[:200])
        return {}


DEV_DB = ENV['DB_NAME']
TEST_DB = f'rhsls_selftest_{uuid.uuid4().hex[:6]}'
st = uuid.uuid4().hex[:6]
c = db()
cur = c.cursor()
cur.execute('INSERT INTO rhs_classes (class_name) VALUES (%s)', (f'ZZCLS_{st}',))
cid = cur.lastrowid
print(f'\n== SETUP: kelas id={cid} ==')

users = []
for i in range(3):
    uname = f'zzcli_{st}_{i}'
    cur.execute('INSERT INTO rhs_users (username, password, role, class_id) VALUES (%s,%s,%s,%s)',
                (uname, PW, 'student' if i < 2 else 'teacher', cid))
    users.append({'id': cur.lastrowid, 'username': uname})
print(f'== 3 user uji dibuat: {[u["username"] for u in users]}')

try:
    print('\n== 1. DASHBOARD & DOCTOR ==')
    out = run('dashboard').stdout
    check('dashboard jalan', 'Ringkasan Sistem' in out)
    out = run('doctor').stdout
    check('doctor jalan', 'Diagnosis Sistem' in out)

    print('\n== 2. SESI ==')
    d = run_json('session:list', '--search', f'zzcli_{st}')
    check('session:list JSON', d.get('count') == 3, str(d.get('count')))

    d = run_json('session:show', users[0]['username'])
    check('session:show', d.get('user', {}).get('username') == users[0]['username'])

    d = run_json('session:stats')
    check('session:stats', d.get('totalUser', 0) > 0, str(d.get('totalUser')))

    # fabricate session lalu reset
    cur.execute("UPDATE rhs_users SET session_id = 'test-session-xyz', last_activity = NOW() WHERE id = %s",
                (users[0]['id'],))
    out = run('session:stuck').stdout
    check('session:stuck jalan', 'Sesi Nyangkut' in out)

    d = run_json('session:reset', '--user', users[0]['username'], '--yes')
    check('session:reset per user', d.get('done') == 1, str(d.get('done')))
    cur.execute('SELECT session_id FROM rhs_users WHERE id = %s', (users[0]['id'],))
    check('session_id jadi NULL', cur.fetchone()['session_id'] is None)

    d = run_json('session:reset', '--user', users[0]['username'], '--dry-run')
    check('session:reset --dry-run', d.get('dryRun') is True, str(d))

    d = run_json('session:sync-online', '--dry-run')
    check('session:sync-online', 'dryRun' in d or 'fixed' in d, str(list(d.keys()))[:60])

    d = run_json('session:audit', users[0]['username'])
    check('session:audit jalan', 'logs' in d, str(len(d.get('logs', []))))

    d = run_json('session:purge-cache', '--dry-run')
    check('session:purge-cache', 'dryRun' in d or d.get('removed') == 0, str(d)[:60])

    print('\n== 3. USER ==')
    d = run_json('user:list', '--search', f'zzcli_{st}')
    check('user:list', d.get('count') == 3, str(d.get('count')))

    d = run_json('user:show', users[1]['username'])
    check('user:show', d.get('user', {}).get('username') == users[1]['username'])

    d = run_json('user:stats')
    check('user:stats', 'byRole' in d, str(d.get('byRole'))[:80])

    # create
    p = run('user:create', '--username', f'zzcli_{st}_new', '--name', 'Uji Baru',
            '--role', 'student', '--class-id', str(cid), '--generate', '--yes')
    check('user:create', p.returncode == 0 and 'dibuat' in p.stdout, p.stdout.strip()[-80:] if p.returncode == 0 else p.stderr[:100])
    cur.execute('SELECT id FROM rhs_users WHERE username = %s', (f'zzcli_{st}_new',))
    row = cur.fetchone()
    new_uid = row['id'] if row else None
    check('user baru tersimpan di DB', new_uid is not None)
    if new_uid:
        users.append({'id': new_uid, 'username': f'zzcli_{st}_new'})

    # verify password
    d = run_json('user:verify-password', users[1]['username'], '--password', 'ini-password-salah')
    check('user:verify-password (salah)', d.get('valid') is False, str(d.get('valid')))

    # update
    d = run_json('user:update', users[1]['username'], '--name', 'Uji Diupdate')
    check('user:update', d.get('updated') == users[1]['id'], str(d.get('updated')))
    cur.execute('SELECT name FROM rhs_users WHERE id = %s', (users[1]['id'],))
    check('nama terupdate', cur.fetchone()['name'] == 'Uji Diupdate')

    # lock / unlock
    run('user:lock', users[1]['username'], '--yes')
    cur.execute('SELECT is_locked FROM rhs_users WHERE id = %s', (users[1]['id'],))
    check('user:lock', cur.fetchone()['is_locked'] == 1)
    d = run_json('user:unlock', users[1]['username'])
    check('user:unlock', d.get('unlocked') == users[1]['username'])
    cur.execute('SELECT is_locked FROM rhs_users WHERE id = %s', (users[1]['id'],))
    check('unlock berhasil', cur.fetchone()['is_locked'] == 0)

    # promote/demote
    d = run_json('user:promote', users[1]['username'], '--to', 'teacher')
    check('user:promote', d.get('to') == 'teacher', str(d))
    run('user:demote', users[1]['username'], '--to', 'student')

    # reset password
    p = run('user:reset-password', users[1]['username'], '--generate')
    check('user:reset-password --generate', p.returncode == 0 and 'Password baru' in p.stdout)

    # export
    csv_path = os.path.join(ROOT, f'zzcli-export-{st}.csv')
    p = run('user:export', '--out', csv_path, '--search', f'zzcli_{st}')
    check('user:export', p.returncode == 0 and os.path.exists(csv_path))
    if os.path.exists(csv_path):
        content = open(csv_path, encoding='utf-8-sig').read()
        check('CSV berisi header', 'username' in content.split('\n')[0])

        # import balik
        d = run_json('user:import', '--file', csv_path, '--dry-run')
        check('user:import --dry-run', d.get('dryRun') is not None or 'created' in d, str(d)[:70])
        os.remove(csv_path)

    # unlock-all
    d = run_json('user:unlock-all', '--yes')
    check('user:unlock-all', 'unlocked' in d, str(d.get('unlocked')))

    d = run_json('user:cleanup', '--older-than', '0', '--dry-run')
    check('user:cleanup dry-run', 'candidates' in d, str(len(d.get('candidates', []))))

    print('\n== 4. DB & PENGATURAN ==')
    d = run_json('db:status')
    check('db:status', d.get('tables', 0) > 0, str(d.get('tables')))

    d = run_json('db:migrate', '--dry-run')
    check('db:migrate dry-run', d.get('dryRun') is True, str(d.get('count')))

    d = run_json('settings:list')
    check('settings:list', 'settings' in d, str(len(d.get('settings', []))))

    d = run_json('settings:get', 'app_emergency_password')
    check('settings:get', 'value' in d or d.get('found') is False, str(d)[:60])

    d = run_json('settings:set', 'zzcli_test_key', 'nilai-uji', '--dry-run')
    check('settings:set dry-run', d.get('dryRun') is True, str(d.get('key')))

    d = run_json('activity:tail', '--limit', '5')
    check('activity:tail', 'logs' in d, str(len(d.get('logs', []))))

    print('\n== 5. BACKUP & RESTORE (database uji terpisah) ==')
    backup_dir = os.path.join(ROOT, 'backups')

    # Buat DB uji lalu isi dengan data minimal
    srv = pymysql.connect(host=ENV['DB_HOST'], user=ENV['DB_USER'], password=ENV['DB_PASSWORD'],
                          autocommit=True, cursorclass=pymysql.cursors.DictCursor)
    sc = srv.cursor()
    sc.execute(f'DROP DATABASE IF EXISTS `{TEST_DB}`')
    sc.execute(f'CREATE DATABASE `{TEST_DB}`')
    sc.close()
    srv.close()

    td = db(TEST_DB)
    tdc = td.cursor()
    for ddl in [
        'CREATE TABLE rhs_users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) NOT NULL,'
        ' password VARCHAR(255), name VARCHAR(255), role VARCHAR(20), class_id INT, session_id VARCHAR(255),'
        ' last_activity DATETIME, last_login DATETIME, is_locked BOOLEAN DEFAULT 0,'
        ' is_online_realtime BOOLEAN DEFAULT 0, failed_login_attempts INT DEFAULT 0,'
        ' locked_until DATETIME NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
        'CREATE TABLE rhs_classes (id INT AUTO_INCREMENT PRIMARY KEY, class_name VARCHAR(255))',
    ]:
        tdc.execute(ddl)
    tdc.execute("INSERT INTO rhs_classes (class_name) VALUES ('Kelas Uji CLI')")
    tdc.execute("INSERT INTO rhs_users (username, password, role, class_id) VALUES ('u1','x','student',1)")
    tdc.execute("INSERT INTO rhs_users (username, password, role, class_id) VALUES ('g1','x','teacher',1)")
    tdc.close()
    td.close()

    bfile = os.path.join(backup_dir, f'rhsls-selftest-{st}.zip')
    d = run_json('backup:create', '--db-name', TEST_DB, '--no-uploads', '--no-secrets',
                 '--out', bfile)
    check('backup:create (DB uji)', d.get('tables', 0) >= 2, str(d.get('tables')))
    check('backup:create menghasilkan berkas', os.path.exists(bfile))

    if os.path.exists(bfile):
        d = run_json('backup:verify', bfile)
        check('backup:verify', d.get('packageOk') is True and d.get('hashOk') is True,
              f"hashOk={d.get('hashOk')}")
        check('verify: jumlah tabel > 0', d.get('summary', {}).get('tables', 0) >= 2,
              str(d.get('summary', {}).get('tables')))
        check('verify: baris > 0', d.get('summary', {}).get('rows', 0) > 0,
              str(d.get('summary', {}).get('rows')))
        check('verify --no-secrets: tanpa env', d.get('summary', {}).get('hasEnv') is False)

        d = run_json('backup:open', bfile, '--limit', '3')
        check('backup:open', d.get('totalEntries', 0) > 2, str(d.get('totalEntries')))

        # GUARD: backup dari TEST_DB tidak boleh masuk ke rush
        p = subprocess.run([CLI, 'backup:restore', bfile, '--db-name', DEV_DB,
                            '--skip-verify', '--no-safety-backup', '--yes'],
                           capture_output=True, text=True, cwd=ROOT, timeout=600)
        combined = (p.stdout or '') + (p.stderr or '')
        check('GUARD: restore ke DB lain DITOLAK',
              p.returncode != 0 and 'tidak cocok' in combined,
              combined.strip()[:100].replace('\n', ' '))

        # kosongkan DB uji lalu restore (nama DB cocok -> boleh)
        srv = pymysql.connect(host=ENV['DB_HOST'], user=ENV['DB_USER'], password=ENV['DB_PASSWORD'],
                              autocommit=True, cursorclass=pymysql.cursors.DictCursor)
        sc = srv.cursor()
        sc.execute(f'DROP DATABASE IF EXISTS `{TEST_DB}`')
        sc.execute(f'CREATE DATABASE `{TEST_DB}`')
        sc.close()
        srv.close()

        p = subprocess.run([CLI, 'backup:restore', bfile, '--db-name', TEST_DB,
                            '--skip-verify', '--no-safety-backup', '--yes'],
                           capture_output=True, text=True, cwd=ROOT, timeout=600)
        check('restore ke DB uji: exit 0', p.returncode == 0, (p.stderr or '').strip()[:120])

        ad = db(TEST_DB)
        adb = ad.cursor()
        adb.execute('SELECT COUNT(*) c FROM rhs_users')
        n = adb.fetchone()['c']
        check('restore: data user pulih ke DB uji', n == 2, f'{n} user')
        adb.execute('SELECT COUNT(*) c FROM rhs_classes')
        check('restore: data kelas pulih', adb.fetchone()['c'] == 1)
        adb.close()
        ad.close()

    d = run_json('backup:prune', '--keep', '100', '--dry-run')
    check('backup:prune dry-run', 'dryRun' in d or d.get('removed') == 0, str(d)[:50])

    print(f'\nTOTAL: PASS {OK} | FAIL {FAIL}')
finally:
    print('\n== CLEANUP ==')
    c2 = db()
    cur2 = c2.cursor()
    ids = [u['id'] for u in users]
    if ids:
        ph = ','.join(['%s'] * len(ids))
        def safe(sql, args=None):
            try:
                cur2.execute(sql, args or ())
                return True
            except Exception as e:
                print('   (cleanup dilewati)', str(e)[:70])
                return False

        safe(f'DELETE FROM rhs_temporary_answer WHERE user_id IN ({ph})', ids)
        safe(f'DELETE FROM rhs_student_answer WHERE user_id IN ({ph})', ids)
        safe(f'DELETE FROM rhs_exam_logs WHERE attempt_id IN (SELECT id FROM rhs_exam_attempts WHERE user_id IN ({ph}))', ids)
        safe(f'DELETE FROM rhs_exam_attempts WHERE user_id IN ({ph})', ids)
        safe(f'DELETE FROM rhs_activity_logs WHERE user_id IN ({ph})', ids)
        safe(f'DELETE FROM rhs_users WHERE id IN ({ph})', ids)
    safe('DELETE FROM rhs_classes WHERE id = %s', (cid,))
    safe("DELETE FROM rhs_web_settings WHERE setting_key = 'zzcli_test_key'")
    cur2.close()
    c2.close()

    try:
        srv = pymysql.connect(host=ENV['DB_HOST'], user=ENV['DB_USER'], password=ENV['DB_PASSWORD'],
                              autocommit=True, cursorclass=pymysql.cursors.DictCursor)
        sc = srv.cursor()
        sc.execute(f'DROP DATABASE IF EXISTS `{TEST_DB}`')
        sc.close()
        srv.close()
        print('  database uji dihapus:', TEST_DB)
    except Exception as e:
        print('  gagal hapus DB uji:', e)

    bd = os.path.join(ROOT, 'backups')
    if os.path.isdir(bd):
        for f in os.listdir(bd):
            if st in f or 'rhsls-selftest' in f:
                for suffix in ('', '.sha256'):
                    fp = os.path.join(bd, f + suffix)
                    if os.path.exists(fp):
                        os.remove(fp)
    print('  data uji dibersihkan')
    sys.exit(1 if FAIL else 0)