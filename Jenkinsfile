pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'rushless-exam'
        DOCKER_TAG = "latest"

        // Credentials mapping based on user example
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
                cat > .env <<EOF
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_NAME=${DB_NAME}
NODE_ENV=production
EOF
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
                sh 'docker compose up -d --build'
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
