import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

async function requireAdmin() {
    const session = await getSession();
    if (!session.user || session.user.roleName !== 'admin') {
        return null;
    }
    return session.user;
}

// GET: List tables, describe table, or select rows
export async function GET(request) {
    if (!await requireAdmin()) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'tables';
    const table = searchParams.get('table');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const orderBy = searchParams.get('orderBy');
    const orderDir = searchParams.get('orderDir') === 'DESC' ? 'DESC' : 'ASC';
    const search = searchParams.get('search') || '';
    const searchCol = searchParams.get('searchCol') || '';

    try {
        // List all tables
        if (action === 'tables') {
            const tables = await query({
                query: `SELECT TABLE_NAME as name, TABLE_ROWS as rowCount, 
                        ENGINE as engine, TABLE_COLLATION as collation,
                        ROUND(DATA_LENGTH / 1024, 2) as dataSizeKB,
                        ROUND(INDEX_LENGTH / 1024, 2) as indexSizeKB,
                        CREATE_TIME as createTime, UPDATE_TIME as updateTime
                        FROM information_schema.TABLES 
                        WHERE TABLE_SCHEMA = DATABASE()
                        ORDER BY TABLE_NAME`
            });
            return NextResponse.json({ tables });
        }

        if (!table) {
            return NextResponse.json({ message: 'Table name required' }, { status: 400 });
        }

        // Validate table name (prevent SQL injection)
        const validTables = await query({
            query: `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
        });
        const tableNames = validTables.map(t => t.TABLE_NAME);
        if (!tableNames.includes(table)) {
            return NextResponse.json({ message: 'Table not found' }, { status: 404 });
        }

        // Describe table columns
        if (action === 'columns') {
            const columns = await query({ query: `SHOW FULL COLUMNS FROM \`${table}\`` });
            const indexes = await query({ query: `SHOW INDEX FROM \`${table}\`` });
            const createTable = await query({ query: `SHOW CREATE TABLE \`${table}\`` });
            return NextResponse.json({
                columns,
                indexes,
                createStatement: createTable[0]?.['Create Table'] || ''
            });
        }

        // Select rows with pagination, sorting, and search
        if (action === 'rows') {
            const offset = (page - 1) * limit;

            // Get total count
            let countQuery = `SELECT COUNT(*) as total FROM \`${table}\``;
            const countValues = [];

            if (search && searchCol) {
                countQuery += ` WHERE \`${searchCol}\` LIKE ?`;
                countValues.push(`%${search}%`);
            }

            const [countResult] = await query({ query: countQuery, values: countValues });
            const total = countResult?.total || 0;

            // Get rows
            let selectQuery = `SELECT * FROM \`${table}\``;
            const selectValues = [];

            if (search && searchCol) {
                selectQuery += ` WHERE \`${searchCol}\` LIKE ?`;
                selectValues.push(`%${search}%`);
            }

            if (orderBy) {
                selectQuery += ` ORDER BY \`${orderBy}\` ${orderDir}`;
            }

            selectQuery += ` LIMIT ? OFFSET ?`;
            selectValues.push(limit, offset);

            const rows = await query({ query: selectQuery, values: selectValues });

            // Get column names
            const cols = await query({ query: `SHOW COLUMNS FROM \`${table}\`` });

            return NextResponse.json({
                rows,
                columns: cols.map(c => c.Field),
                columnDetails: cols,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        }

        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('DB Manager error:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

// POST: Insert row, Update row, Delete row, or Run raw SQL
export async function POST(request) {
    if (!await requireAdmin()) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, table, data, where, sql } = body;

        // Validate table if provided
        if (table) {
            const validTables = await query({
                query: `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
            });
            if (!validTables.map(t => t.TABLE_NAME).includes(table)) {
                return NextResponse.json({ message: 'Table not found' }, { status: 404 });
            }
        }

        // INSERT
        if (action === 'insert') {
            if (!table || !data || typeof data !== 'object') {
                return NextResponse.json({ message: 'Table and data required' }, { status: 400 });
            }
            const keys = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== '');
            const values = keys.map(k => data[k] === '__NULL__' ? null : data[k]);
            const placeholders = keys.map(() => '?').join(', ');
            const cols = keys.map(k => `\`${k}\``).join(', ');

            const result = await query({
                query: `INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`,
                values
            });
            return NextResponse.json({ message: 'Row inserted', insertId: result.insertId });
        }

        // UPDATE
        if (action === 'update') {
            if (!table || !data || !where) {
                return NextResponse.json({ message: 'Table, data, and where required' }, { status: 400 });
            }
            const setClauses = [];
            const setValues = [];
            for (const [key, val] of Object.entries(data)) {
                setClauses.push(`\`${key}\` = ?`);
                setValues.push(val === '__NULL__' ? null : val);
            }

            const whereClauses = [];
            const whereValues = [];
            for (const [key, val] of Object.entries(where)) {
                if (val === null) {
                    whereClauses.push(`\`${key}\` IS NULL`);
                } else {
                    whereClauses.push(`\`${key}\` = ?`);
                    whereValues.push(val);
                }
            }

            const result = await query({
                query: `UPDATE \`${table}\` SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} LIMIT 1`,
                values: [...setValues, ...whereValues]
            });
            return NextResponse.json({ message: 'Row updated', affectedRows: result.affectedRows });
        }

        // DELETE
        if (action === 'delete') {
            if (!table || !where) {
                return NextResponse.json({ message: 'Table and where required' }, { status: 400 });
            }
            const whereClauses = [];
            const whereValues = [];
            for (const [key, val] of Object.entries(where)) {
                if (val === null) {
                    whereClauses.push(`\`${key}\` IS NULL`);
                } else {
                    whereClauses.push(`\`${key}\` = ?`);
                    whereValues.push(val);
                }
            }

            const result = await query({
                query: `DELETE FROM \`${table}\` WHERE ${whereClauses.join(' AND ')} LIMIT 1`,
                values: whereValues
            });
            return NextResponse.json({ message: 'Row deleted', affectedRows: result.affectedRows });
        }

        // RAW SQL
        if (action === 'sql') {
            if (!sql || typeof sql !== 'string') {
                return NextResponse.json({ message: 'SQL query required' }, { status: 400 });
            }
            // Safety: limit to 1000 rows for SELECT
            const trimmedSql = sql.trim();
            const isSelect = /^(SELECT|SHOW|DESCRIBE|EXPLAIN)/i.test(trimmedSql);

            const startTime = Date.now();
            const result = await query({ query: trimmedSql });
            const duration = Date.now() - startTime;

            if (isSelect) {
                const rows = Array.isArray(result) ? result.slice(0, 1000) : [];
                const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                return NextResponse.json({
                    type: 'select',
                    rows,
                    columns,
                    rowCount: rows.length,
                    duration
                });
            } else {
                return NextResponse.json({
                    type: 'execute',
                    affectedRows: result.affectedRows || 0,
                    insertId: result.insertId || null,
                    duration
                });
            }
        }

        // TRUNCATE
        if (action === 'truncate') {
            if (!table) {
                return NextResponse.json({ message: 'Table required' }, { status: 400 });
            }
            await query({ query: `TRUNCATE TABLE \`${table}\`` });
            return NextResponse.json({ message: `Table ${table} truncated` });
        }

        // DROP
        if (action === 'drop') {
            if (!table) {
                return NextResponse.json({ message: 'Table required' }, { status: 400 });
            }
            await query({ query: `DROP TABLE \`${table}\`` });
            return NextResponse.json({ message: `Table ${table} dropped` });
        }

        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('DB Manager error:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
