pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'rushless-exam'
        DOCKER_TAG = "latest"

        // Path absolut di server Linux agar tidak terhapus cleanWs()
        UPLOAD_PATH = "/var/lib/rushless-data/uploads"

        // Credentials mapping
        DB_HOST = credentials('RUSHLESS_DB_HOST')
        DB_USER = credentials('RUSHLESS_DB_USER')
        DB_PASSWORD = credentials('RUSHLESS_DB_PASSWORD')
        DB_NAME = credentials('RUSHLESS_DB_NAME')
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
                # 1. Buat file environment
                cat > .env <<EOF
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_NAME=${DB_NAME}
NODE_ENV=production
EOF
                # 2. Siapkan folder upload di host Linux
                # Menggunakan sudo karena biasanya folder sistem butuh akses root
                sudo mkdir -p ${UPLOAD_PATH}
                
                # 3. Berikan izin akses ke UID 1001 (user nextjs di Dockerfile)
                sudo chown -R 1001:1001 ${UPLOAD_PATH}
                sudo chmod -R 775 ${UPLOAD_PATH}
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
                // Menggunakan docker compose dengan force recreate agar perubahan volume terbaca
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
            // Ini akan menghapus folder project di workspace, 
            // tapi folder di ${UPLOAD_PATH} akan tetap aman.
            cleanWs()
        }
    }
}