# Dockerfile — Jenkins LTS + Docker CLI
# ใช้สำหรับรัน Jenkins ที่ต้องสั่งงาน Docker บนเครื่อง host ได้
# (จำเป็นสำหรับ pipeline ที่ใช้ docker.image('...').inside(...) ใน ../Jenkinsfile)
#
# Build:
#   docker build -t yamzab-jenkins ./jenkins
# Run (mount host's docker.sock so this container can drive the host's Docker daemon):
#   docker run -d --name jenkins -p 8080:8080 -p 50000:50000 \
#     -v jenkins_home:/var/jenkins_home \
#     -v /var/run/docker.sock:/var/run/docker.sock \
#     yamzab-jenkins

FROM jenkins/jenkins:lts

USER root

# ติดตั้ง Docker CLI (ไม่ใช่ Docker daemon — ใช้ daemon ของ host ผ่าน docker.sock ที่ mount เข้ามา)
RUN apt-get update -qq && \
    apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update -qq \
    && apt-get install -y -qq docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# ให้ user jenkins เรียก docker ได้โดยไม่ต้อง sudo.
# group id ของ docker.sock บน host อาจไม่ตรงกับ group "docker" ที่สร้างในอิมเมจนี้ —
# ถ้าเจอ "permission denied" ตอน pipeline สั่ง docker ให้หา gid จริงบน host ด้วย
# `stat -c '%g' /var/run/docker.sock` แล้ว build ใหม่พร้อม
# `--build-arg DOCKER_GID=<gid นั้น>` (ดู ARG ด้านล่าง) หรือรัน container นี้ด้วย
# `--group-add <gid>` แทนก็ได้โดยไม่ต้อง build ใหม่
ARG DOCKER_GID=999
RUN groupmod -g "${DOCKER_GID}" docker 2>/dev/null || groupadd -g "${DOCKER_GID}" docker; \
    usermod -aG docker jenkins

USER jenkins
