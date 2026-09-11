// CI pipeline for Yam Zabb POS.
// Requires: Jenkins agent with Docker available (Docker Pipeline plugin) so a
// throwaway PostgreSQL container and a Node.js build container can be run.
// Also requires a SonarQube server configured under Manage Jenkins > System >
// SonarQube servers, named "SonarQube" (SonarQube Scanner plugin), with an
// auth token credential and a webhook back to this Jenkins for the quality
// gate step. See README.md's "Static analysis: SonarQube" section.
// This is CI only (build + test) — no deploy stage.
pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        ansiColor('xterm')
    }

    environment {
        JWT_SECRET          = 'ci-test-secret-not-for-production'
        JWT_EXPIRES_IN      = '12h'
        PORT                = '4000'
        CLIENT_ORIGIN       = 'http://localhost:5173'
        VITE_PROMPTPAY_ID   = '0955555555'
        VITE_MERCHANT_NAME  = 'ร้าน ยำแซ่บ (CI)'
        CI                  = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build & Test') {
            steps {
                script {
                    docker.image('postgres:16-alpine').withRun(
                        '-e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=yam_zabb_pos'
                    ) { db ->
                        docker.image('node:20-bookworm').inside("--network container:${db.id} -u root:root") {
                            env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/yam_zabb_pos?schema=public'

                            stage('Wait for database') {
                                sh '''#!/usr/bin/env bash
                                    set -e
                                    for i in $(seq 1 30); do
                                        (echo > /dev/tcp/localhost/5432) >/dev/null 2>&1 && exit 0
                                        sleep 1
                                    done
                                    echo "Postgres did not become ready in time" >&2
                                    exit 1
                                '''
                            }

                            stage('Install dependencies') {
                                sh 'npm ci'
                            }

                            stage('Generate Prisma client') {
                                // Unlike `prisma migrate dev`, `migrate deploy` (used below) never runs
                                // `generate` itself, and the postinstall hook can't find the schema inside
                                // this npm workspace layout — so it must be generated explicitly here.
                                sh 'npm run prisma:generate --workspace server'
                            }

                            stage('Apply migrations & seed') {
                                sh 'npm run prisma:deploy --workspace server'
                                sh 'npm run db:seed'
                            }

                            stage('Build client') {
                                sh 'npm run build'
                            }

                            stage('Install Playwright browsers') {
                                sh 'npx playwright install --with-deps chromium'
                            }

                            stage('Playwright E2E tests') {
                                sh 'npm run test:e2e'
                            }

                            stage('SonarQube analysis') {
                                sh '''#!/usr/bin/env bash
                                    set -e
                                    if ! command -v sonar-scanner >/dev/null 2>&1 && [ ! -x /opt/sonar-scanner/bin/sonar-scanner ]; then
                                        apt-get update -qq
                                        apt-get install -y -qq default-jre-headless unzip curl >/dev/null
                                        curl -sSLo /tmp/sonar-scanner.zip \
                                            https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-6.2.1.4610-linux-x64.zip
                                        unzip -q /tmp/sonar-scanner.zip -d /opt
                                        mv /opt/sonar-scanner-*-linux-x64 /opt/sonar-scanner
                                    fi
                                '''
                                withSonarQubeEnv('SonarQube') {
                                    sh '/opt/sonar-scanner/bin/sonar-scanner'
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }
    }

    post {
        always {
            junit testResults: 'test-results/junit.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'playwright-report/**, test-results/**, client/dist/**', allowEmptyArchive: true
            catchError(buildResult: null, stageResult: null, message: 'HTML Publisher plugin not installed?') {
                publishHTML(target: [
                    reportName : 'Playwright report',
                    reportDir  : 'playwright-report',
                    reportFiles: 'index.html',
                    keepAll    : true,
                    alwaysLinkToLastBuild: true,
                    allowMissing: true,
                ])
            }
        }
    }
}
