pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'rushless-exam'
        DOCKER_TAG = "latest"

        // Credentials mapping
        DB_HOST = credentials('RUSHLESS_DB_HOST')
        DB_USER = credentials('RUSHLESS_DB_USER')
        DB_PASSWORD = credentials('RUSHLESS_DB_PASSWORD')
        DB_NAME = credentials('RUSHLESS_DB_NAME')
        NODE_ENV = credentials('RUSHLESS_NODE_ENV')
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
                # Jenkins hanya fokus membuat file .env
                cat > .env <<EOF
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_NAME=${DB_NAME}
NODE_ENV=${NODE_ENV}
REDIS_HOST=127.0.0.1
TZ=Asia/Jakarta
EOF
                # Bersihkan karakter \r (Windows) agar tidak merusak variabel env
                tr -d '\\r' < .env > .env.tmp && mv .env.tmp .env
                # Bersihkan karakter \r (Windows) yang bisa merusak NODE_ENV
                tr -d '\\r' < .env > .env.tmp && mv .env.tmp .env
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