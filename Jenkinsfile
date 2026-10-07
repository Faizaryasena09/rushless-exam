pipeline {
    agent any

    parameters {
        // Zona waktu bisa diubah per-build tanpa edit Jenkinsfile.
        // Kosongkan untuk memakai default (Asia/Jakarta) atau nilai dari
        // credential RUSHLESS_APP_TIMEZONE bila ada.
        string(
            name: 'APP_TIMEZONE',
            defaultValue: '',
            description: 'Zona waktu aplikasi (IANA). Contoh: Asia/Jakarta, Asia/Makassar. Kosongkan untuk default.'
        )
    }

    environment {
        DOCKER_IMAGE = 'rushless-exam'
        DOCKER_TAG = "latest"

        // Credentials mapping
        DB_HOST = credentials('RUSHLESS_DB_HOST')
        DB_USER = credentials('RUSHLESS_DB_USER')
        DB_PASSWORD = credentials('RUSHLESS_DB_PASSWORD')
        DB_NAME = credentials('RUSHLESS_DB_NAME')
        NODE_ENV = credentials('RUSHLESS_NODE_ENV')

        // Kosongkan untuk memakai default Asia/Jakarta.
        // Nilai di-hardcode di sini (bukan variabel lain) supaya tidak bergantung
        // pada resolusi variabel antar baris di dalam blok environment.
        TZ = "${params.APP_TIMEZONE?.trim() ?: 'Asia/Jakarta'}"
        APP_TIMEZONE = "${params.APP_TIMEZONE?.trim() ?: 'Asia/Jakarta'}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Environment') {
            steps {
                sh '''
                # Validasi zona waktu sebelum dipakai, supaya build gagal cepat
                # daripada deploy aplikasi dengan TZ ngawur.
                node <<'TZCHECK'
                const tz = process.env.TZ || '';
                try {
                    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date(0));
                    console.log('[tz] OK:', tz);
                } catch (e) {
                    console.error('[tz] ZONA WAKTU TIDAK VALID:', tz);
                    process.exit(1);
                }
                TZCHECK

                # Jenkins hanya fokus membuat file .env
                cat > .env <<EOF
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_NAME=${DB_NAME}
NODE_ENV=${NODE_ENV}
REDIS_HOST=127.0.0.1
TZ=${TZ}
APP_TIMEZONE=${APP_TIMEZONE}
EOF
                # Bersihkan karakter \\r (Windows) agar tidak merusak variabel env
                tr -d '\\r' < .env > .env.tmp && mv .env.tmp .env
                # Bersihkan karakter \\r (Windows) yang bisa merusak NODE_ENV
                tr -d '\\r' < .env > .env.tmp && mv .env.tmp .env

                echo "--- .env ---"
                # Sembunyikan password saat mencetak log build.
                sed 's/^DB_PASSWORD=.*/DB_PASSWORD=***/' .env
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
            }
        }

        stage('Deploy') {
            steps {
                // Docker Compose akan otomatis menggunakan folder yang sudah kita siapkan di host
                sh 'docker compose up -d --build --remove-orphans'
            }
        }
    }

    post {
        success {
            echo 'Build Rushless Exam Successful!'
        }
        failure {
            echo 'Build Rushless Exam Failed.'
        }
        cleanup {
            cleanWs()
        }
    }
}