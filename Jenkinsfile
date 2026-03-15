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
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Environment') {
            steps {
                sh """
                echo "DB_USER=${DB_USER}" > .env
                echo "DB_PASSWORD=${DB_PASSWORD}" >> .env
                echo "DB_HOST=${DB_HOST}" >> .env
                echo "DB_NAME=${DB_NAME}" >> .env
                echo "NODE_ENV=production" >> .env
                """
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